import { NextRequest, NextResponse } from "next/server";
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

const ASSIGNMENT_CONFLICT = "ASSIGNMENT_CONFLICT";
const VALIDATION_FAILED = "VALIDATION_FAILED";
const NOT_FOUND = "NOT_FOUND";

interface AssignShiftBody {
  shiftId: string;
  userId: string;
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

  const { shiftId, userId } = body;
  if (!shiftId || !userId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "shiftId and userId are required" },
      { status: 400 }
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

      // 2. Fetch shift with required skills
      const shift = await tx.shift.findUnique({
        where: { id: shiftId },
        include: {
          requiredSkills: { select: { skillId: true } },
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

      // 3. Re-fetch all constraint data inside transaction (fresh read after lock)
      const [
        userAssignments,
        userSkills,
        userCerts,
        userAvailability,
        allStaffSkills,
        allCertsForLocation,
      ] = await Promise.all([
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

      // 4. Check for existing assignment (unique constraint)
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

      // 5. Build policy inputs and re-check constraints
      const policyShift: PolicyShift = {
        id: shift.id,
        locationId: shift.locationId,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        requiredSkillIds: shift.requiredSkills.map((s) => s.skillId),
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

      const validation = validateShiftAssignment({
        shift: policyShift,
        userId,
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
        now: new Date(),
      });

      if (!validation.valid) {
        const conflictBlock = validation.blocks[0];
        const conflictType =
          conflictBlock?.code === "DOUBLE_BOOKING"
            ? "double-booking"
            : conflictBlock?.code === "REST_VIOLATION"
              ? "rest-period"
              : conflictBlock?.code === "WEEKLY_HOURS_EXCEEDED" ||
                  conflictBlock?.code === "DAILY_HOURS_EXCEEDED"
                ? "overtime"
                : "double-booking";
        await broadcastAssignmentConflict(userId, {
          shiftId,
          userId,
          conflictType,
          message: conflictBlock?.message,
        });

        return {
          success: false as const,
          error: {
            code: VALIDATION_FAILED,
            message: "Shift assignment validation failed",
            details: {
              blocks: validation.blocks,
              warnings: validation.warnings,
            },
          },
        };
      }

      // 6. Create assignment
      const assignment = await tx.shiftAssignment.create({
        data: {
          shiftId,
          userId,
          status: "confirmed",
        },
      });

      // 7. Create notification
      await tx.notification.create({
        data: {
          userId,
          type: "SHIFT_ASSIGNED",
          title: "New shift assigned",
          body: `You have been assigned to a shift.`,
          data: { shiftId, assignmentId: assignment.id },
        },
      });

      // 8. Broadcast shift assigned (fire-and-forget, outside tx)
      void broadcastShiftAssigned(userId, shift.locationId, {
        assignmentId: assignment.id,
        shiftId,
      });

      return {
        success: true as const,
        data: {
          assignment: {
            id: assignment.id,
            shiftId: assignment.shiftId,
            userId: assignment.userId,
            status: assignment.status,
          },
        },
      };
    });

    if (!result.success) {
      const { code, message, details } = result.error;
      const status =
        code === NOT_FOUND
          ? 404
          : code === ASSIGNMENT_CONFLICT
            ? 409
            : 422;
      return NextResponse.json(
        { code, message, ...(details && { details }) },
        { status }
      );
    }

    return NextResponse.json(result.data, { status: 201 });
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
