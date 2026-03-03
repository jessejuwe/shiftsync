import { NextRequest, NextResponse } from "next/server";
import { AuditLogAction } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  broadcastAssignmentConflict,
  broadcastShiftAssigned,
} from "@/lib/pusher-events";
import {
  validateShiftAssignment,
  type PolicyShift,
  type PolicyAssignment,
  type PolicyCertification,
  type PolicyAvailabilityWindow,
} from "@/lib/domain/shift-policy";
import { STAFF_PICKUP_MESSAGES } from "@/lib/validation-messages";
import { maybeSimulateNotificationEmail } from "@/lib/email-simulator";

const ASSIGNMENT_CONFLICT = "ASSIGNMENT_CONFLICT";
const VALIDATION_FAILED = "VALIDATION_FAILED";
const NOT_FOUND = "NOT_FOUND";
const NOT_PUBLISHED = "NOT_PUBLISHED";

interface AssignShiftBody {
  shiftId: string;
  userId: string;
  overrideReason?: string;
}

function toPolicyAssignment(a: {
  id: string;
  shiftId: string;
  userId: string;
  shift: { startsAt: Date; endsAt: Date };
}): PolicyAssignment {
  return {
    id: a.id,
    shiftId: a.shiftId,
    userId: a.userId,
    startsAt: a.shift.startsAt,
    endsAt: a.shift.endsAt,
  };
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function POST(request: NextRequest) {
  let body: AssignShiftBody;
  try {
    body = (await request.json()) as AssignShiftBody;
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { shiftId, userId, overrideReason } = body;
  if (!shiftId || !userId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "shiftId and userId are required" },
      { status: 400 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required" },
      { status: 401 }
    );
  }

  // Staff can only assign themselves (pick up); managers/admins can assign anyone
  const role = (session.user as { role?: string })?.role;
  const canManageOthers = role === "ADMIN" || role === "MANAGER";
  if (userId !== session.user.id && !canManageOthers) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You can only pick up shifts for yourself" },
      { status: 403 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock staff record to prevent race conditions
      const lockedUser = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

      if (!lockedUser.length) {
        return {
          success: false as const,
          error: {
            code: NOT_FOUND,
            message: "User not found",
            details: { userId },
          },
        };
      }

      // 2. Fetch shift with required skills and names (for validation messages)
      const shift = await tx.shift.findUnique({
        where: { id: shiftId },
        include: {
          requiredSkills: {
            select: { skillId: true, skill: { select: { name: true } } },
          },
        },
      });

      if (!shift) {
        return {
          success: false as const,
          error: {
            code: NOT_FOUND,
            message: "Shift not found",
            details: { shiftId },
          },
        };
      }

      // Staff can only pick up published shifts
      if (userId === session.user.id && !shift.isPublished) {
        return {
          success: false as const,
          error: {
            code: "NOT_PUBLISHED",
            message: "This shift is not yet published. Only published shifts can be picked up.",
            details: { shiftId },
          },
        };
      }

      // 3. Re-fetch all constraint data inside transaction (fresh read after lock)
      const [
        assigningUser,
        userAssignments,
        userSkills,
        userCerts,
        userAvailability,
        allStaffSkills,
        allCertsForLocation,
      ] = await Promise.all([
        tx.user.findUnique({
          where: { id: userId },
          select: { name: true },
        }),
        tx.shiftAssignment.findMany({
          where: { userId },
          include: { shift: { select: { startsAt: true, endsAt: true } } },
        }),
        tx.staffSkill.findMany({
          where: { userId },
          select: { skillId: true },
        }),
        tx.certification.findMany({
          where: { userId },
          select: { locationId: true, expiresAt: true },
        }),
        tx.availabilityWindow.findMany({
          where: { userId, locationId: shift.locationId },
          select: {
            startsAt: true,
            endsAt: true,
            locationId: true,
            dayOfWeek: true,
            isRecurring: true,
          },
        }),
        tx.staffSkill.findMany({
          where: {
            skillId: { in: shift.requiredSkills.map((s) => s.skillId) },
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
        tx.certification.findMany({
          where: {
            locationId: shift.locationId,
            expiresAt: { gt: new Date() },
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
      ]);

      // 4. Check headcount - shift must have capacity
      const assignmentCount = await tx.shiftAssignment.count({
        where: { shiftId },
      });
      if (assignmentCount >= shift.headcount) {
        return {
          success: false as const,
          error: {
            code: "HEADCOUNT_EXCEEDED",
            message: `This shift is full (${assignmentCount}/${shift.headcount} assigned).`,
            details: { shiftId, headcount: shift.headcount, assigned: assignmentCount },
          },
        };
      }

      // 5. Check for existing assignment (unique constraint)
      const existingAssignment = await tx.shiftAssignment.findUnique({
        where: { shiftId_userId: { shiftId, userId } },
      });

      if (existingAssignment) {
        return {
          success: false as const,
          error: {
            code: ASSIGNMENT_CONFLICT,
            message: "User is already assigned to this shift",
            details: { shiftId, userId, assignmentId: existingAssignment.id },
          },
        };
      }

      // 6. Build policy inputs and re-check constraints
      const policyShift: PolicyShift = {
        id: shift.id,
        locationId: shift.locationId,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        requiredSkillIds: shift.requiredSkills.map((s) => s.skillId),
        requiredSkillNames: shift.requiredSkills.map((s) => ({
          id: s.skillId,
          name: s.skill.name,
        })),
      };

      const policyAssignments = userAssignments.map(toPolicyAssignment);
      const weekStart = getWeekStart(shift.startsAt);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      const assignmentsInWeek = userAssignments.filter((a) => {
        const s = a.shift.startsAt;
        return s >= weekStart && s <= weekEnd;
      });

      const userSkillIds = userSkills.map((s) => s.skillId);
      const policyCerts: PolicyCertification[] = userCerts.map((c) => ({
        userId,
        locationId: c.locationId,
        expiresAt: c.expiresAt,
      }));

      const policyWindows: PolicyAvailabilityWindow[] = userAvailability.map(
        (w) => ({
          userId,
          locationId: w.locationId,
          startsAt: w.startsAt,
          endsAt: w.endsAt,
          dayOfWeek: w.dayOfWeek,
          isRecurring: w.isRecurring,
        })
      );

      const skillsByUser = new Map<
        string,
        { user: { id: string; name: string; email: string }; skillIds: string[] }
      >();
      for (const s of allStaffSkills) {
        const existing = skillsByUser.get(s.userId);
        const skillIds = existing
          ? [...existing.skillIds, s.skillId]
          : [s.skillId];
        const unique = [...new Set(skillIds)];
        skillsByUser.set(s.userId, {
          user: s.user,
          skillIds: unique,
        });
      }
      const usersWithAllSkills = Array.from(skillsByUser.entries())
        .filter(
          ([uid, { skillIds }]) =>
            uid !== userId &&
            policyShift.requiredSkillIds.every((rid) => skillIds.includes(rid))
        )
        .map(([, { user, skillIds }]) => ({ ...user, skillIds }));

      const usersWithCerts = allCertsForLocation
        .filter((c) => c.userId !== userId)
        .map((c) => ({
          id: c.user.id,
          name: c.user.name,
          email: c.user.email,
          hasValidCert: true,
        }));
      const uniqueCertUsers = Array.from(
        new Map(usersWithCerts.map((u) => [u.id, u])).values()
      );

      // Compute fully qualified alternatives (cert + skills + availability + no conflicts)
      const certIds = new Set(uniqueCertUsers.map((u) => u.id));
      const candidates = usersWithAllSkills.filter((u) => certIds.has(u.id));
      const candidateIds = candidates.map((c) => c.id);

      let qualifiedAlternatives: { id: string; name: string; email: string }[] =
        [];
      if (candidateIds.length > 0) {
        const [candidateAvailability, candidateAssignments] = await Promise.all([
          tx.availabilityWindow.findMany({
            where: {
              userId: { in: candidateIds },
              locationId: shift.locationId,
            },
            select: {
              userId: true,
              startsAt: true,
              endsAt: true,
              locationId: true,
              dayOfWeek: true,
              isRecurring: true,
            },
          }),
          tx.shiftAssignment.findMany({
            where: { userId: { in: candidateIds } },
            include: { shift: { select: { startsAt: true, endsAt: true } } },
          }),
        ]);

        const availByUser = new Map<string, typeof candidateAvailability>();
        for (const w of candidateAvailability) {
          const list = availByUser.get(w.userId) ?? [];
          list.push(w);
          availByUser.set(w.userId, list);
        }
        const assignmentsByUser = new Map<
          string,
          { id: string; shiftId: string; userId: string; shift: { startsAt: Date; endsAt: Date } }[]
        >();
        for (const a of candidateAssignments) {
          const list = assignmentsByUser.get(a.userId) ?? [];
          list.push(a);
          assignmentsByUser.set(a.userId, list);
        }

        const weekStartAlt = getWeekStart(shift.startsAt);
        const weekEndAlt = new Date(weekStartAlt);
        weekEndAlt.setUTCDate(weekEndAlt.getUTCDate() + 6);
        weekEndAlt.setUTCHours(23, 59, 59, 999);

        for (const cand of candidates) {
          const candAssignments = assignmentsByUser.get(cand.id) ?? [];
          const candAssignmentsInWeek = candAssignments.filter((a) => {
            const s = a.shift.startsAt;
            return s >= weekStartAlt && s <= weekEndAlt;
          });
          const candWindows = (availByUser.get(cand.id) ?? []).map((w) => ({
            userId: cand.id,
            locationId: w.locationId,
            startsAt: w.startsAt,
            endsAt: w.endsAt,
            dayOfWeek: w.dayOfWeek,
            isRecurring: w.isRecurring,
          }));
          const candCerts = allCertsForLocation
            .filter((c) => c.userId === cand.id)
            .map((c) => ({
              userId: c.userId,
              locationId: c.locationId,
              expiresAt: c.expiresAt,
            }));

          const candValidation = validateShiftAssignment({
            shift: policyShift,
            userId: cand.id,
            userSkillIds: cand.skillIds,
            userCertifications: candCerts,
            userAvailabilityWindows: candWindows,
            userAssignments: candAssignments.map(toPolicyAssignment),
            userAssignmentsInWeek: candAssignmentsInWeek.map(toPolicyAssignment),
            allUsersWithSkills: usersWithAllSkills,
            allUsersWithLocationCerts: uniqueCertUsers,
            allUsersWithAvailability: uniqueCertUsers.map((u) => ({
              ...u,
              hasAvailability: true,
            })),
            now: new Date(),
          });

          if (candValidation.valid) {
            qualifiedAlternatives.push({
              id: cand.id,
              name: cand.name,
              email: cand.email,
            });
          }
        }
      }

      const validation = validateShiftAssignment({
        shift: policyShift,
        userId,
        userName: assigningUser?.name ?? undefined,
        userSkillIds,
        userCertifications: policyCerts,
        userAvailabilityWindows: policyWindows,
        userAssignments: policyAssignments,
        userAssignmentsInWeek: assignmentsInWeek.map(toPolicyAssignment),
        allUsersWithSkills: usersWithAllSkills,
        allUsersWithLocationCerts: uniqueCertUsers,
        allUsersWithAvailability: uniqueCertUsers.map((u) => ({
          ...u,
          hasAvailability: true,
        })),
        qualifiedAlternatives:
          qualifiedAlternatives.length > 0 ? qualifiedAlternatives : undefined,
        now: new Date(),
      });

      const canOverride =
        !validation.valid &&
        validation.blocks.length === 1 &&
        validation.blocks[0].metadata?.requiresOverride === true &&
        typeof overrideReason === "string" &&
        overrideReason.trim().length > 0 &&
        (session?.user as { role?: string } | undefined)?.role &&
        ["MANAGER", "ADMIN"].includes((session!.user as { role?: string }).role!);

      const canOverride7thDay =
        canOverride && validation.blocks[0].code === "CONSECUTIVE_DAYS_EXCEEDED";

      if (!validation.valid && !canOverride7thDay) {
        const conflictBlock = validation.blocks[0];
        const conflictType =
          conflictBlock?.code === "DOUBLE_BOOKING"
            ? "double-booking"
            : conflictBlock?.code === "REST_VIOLATION"
              ? "rest-period"
              : conflictBlock?.code === "AVAILABILITY_VIOLATION" ||
                  conflictBlock?.code === "NO_AVAILABILITY_SET"
                ? "availability"
                : conflictBlock?.code === "WEEKLY_HOURS_EXCEEDED" ||
                    conflictBlock?.code === "DAILY_HOURS_EXCEEDED" ||
                    conflictBlock?.code === "DAILY_HOURS_WARNING"
                  ? "overtime"
                  : "double-booking";
        const isStaffPickup = userId === session.user.id;
        const staffMessage =
          isStaffPickup &&
          conflictBlock?.code &&
          conflictBlock.code in STAFF_PICKUP_MESSAGES
            ? STAFF_PICKUP_MESSAGES[conflictBlock.code]
            : null;
        const userMessage =
          staffMessage ?? conflictBlock?.message ?? "Shift assignment validation failed";
        const qualifiedIds = new Set(qualifiedAlternatives.map((q) => q.id));
        const filterSuggestions = <T extends { suggestions?: { id: string }[] }>(
          items: T[]
        ) =>
          items.map((item) => ({
            ...item,
            suggestions: item.suggestions?.filter((s) => qualifiedIds.has(s.id)),
          }));
        return {
          success: false as const,
          error: {
            code: VALIDATION_FAILED,
            message: userMessage,
            details: {
              blocks: filterSuggestions(validation.blocks),
              warnings: filterSuggestions(validation.warnings),
            },
            conflictPayload: {
              userId,
              shiftId,
              conflictType,
              message: conflictBlock?.message,
            },
          },
        };
      }

      // 7. Create assignment
      const assignment = await tx.shiftAssignment.create({
        data: {
          shiftId,
          userId,
          status: "confirmed",
        },
      });

      // 8. Create notification
      await tx.notification.create({
        data: {
          userId,
          type: "SHIFT_ASSIGNED",
          title: "New shift assigned",
          body: `You have been assigned to a shift.`,
          data: { shiftId, assignmentId: assignment.id },
        },
      });

      // 9. Audit log
      if (session?.user?.id) {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: canOverride7thDay
              ? AuditLogAction.OVERRIDE_7TH_DAY
              : AuditLogAction.SHIFT_ASSIGNED,
            entityType: "ShiftAssignment",
            entityId: assignment.id,
            locationId: shift.locationId,
            changes: {
              before: null,
              after: {
                assignmentId: assignment.id,
                shiftId,
                assignedUserId: userId,
                ...(canOverride7thDay && {
                  overrideReason: overrideReason!.trim(),
                }),
              },
            },
          },
        });
      }

      return {
        success: true as const,
        data: {
          assignment: {
            id: assignment.id,
            shiftId: assignment.shiftId,
            userId: assignment.userId,
            status: assignment.status,
          },
          locationId: shift.locationId,
        },
      };
    }, { timeout: 10000 });

    if (!result.success) {
      const { code, message, details, conflictPayload } = result.error;
      const status =
        code === NOT_FOUND
          ? 404
          : code === ASSIGNMENT_CONFLICT
            ? 409
            : code === NOT_PUBLISHED || code === "HEADCOUNT_EXCEEDED"
              ? 400
              : 422;
      if (conflictPayload) {
        void broadcastAssignmentConflict(conflictPayload.userId, {
          shiftId: conflictPayload.shiftId,
          userId: conflictPayload.userId,
          conflictType: conflictPayload.conflictType as
            | "double-booking"
            | "rest-period"
            | "availability"
            | "overtime",
          message: conflictPayload.message,
        });
      }
      return NextResponse.json(
        { code, message, ...(details && { details }) },
        { status }
      );
    }

    // Broadcast after transaction commits so clients only receive if assignment persisted
    void broadcastShiftAssigned(userId, result.data.locationId, {
      assignmentId: result.data.assignment.id,
      shiftId: result.data.assignment.shiftId,
    });

    void maybeSimulateNotificationEmail({
      userId,
      type: "SHIFT_ASSIGNED",
      title: "New shift assigned",
      body: "You have been assigned to a shift.",
    });

    return NextResponse.json(
      { assignment: result.data.assignment },
      { status: 201 }
    );
  } catch (err) {
    // Handle Prisma unique constraint violation (P2002)
    const prismaError = err as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        {
          code: ASSIGNMENT_CONFLICT,
          message: "User is already assigned to this shift",
          details: { shiftId, userId },
        },
        { status: 409 }
      );
    }

    console.error("Shift assign error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
