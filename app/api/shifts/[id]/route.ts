import { NextRequest, NextResponse } from "next/server";
import type { NotificationType } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastShiftEdited } from "@/lib/pusher-events";
import {
  SwapEvent,
  transition,
  toPrismaStatus,
  fromPrismaStatus,
} from "@/lib/domain/swap-workflow";
import {
  validateShiftAssignment,
  type PolicyShift,
  type PolicyAssignment,
  type PolicyCertification,
  type PolicyAvailabilityWindow,
} from "@/lib/domain/shift-policy";
import { canUnpublishOrEdit } from "@/config/schedule";

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

/**
 * PATCH /api/shifts/[id]
 * Update a shift and broadcast to schedule subscribers.
 * Admin/Manager only. When changing times or required skills, validates that all
 * existing assignments still satisfy constraints (overtime, availability, etc.).
 * Shift update and auto-cancel of affected swap requests run atomically in a transaction.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Admin or Manager access required" },
      { status: 403 }
    );
  }

  const { id } = await params;

  let body: {
    startsAt?: string;
    endsAt?: string;
    title?: string;
    notes?: string;
    headcount?: number;
    isPublished?: boolean;
    requiredSkillIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const updateData: {
    startsAt?: Date;
    endsAt?: Date;
    title?: string;
    notes?: string;
    headcount?: number;
    isPublished?: boolean;
  } = {};

  if (body.startsAt != null) updateData.startsAt = new Date(body.startsAt);
  if (body.endsAt != null) updateData.endsAt = new Date(body.endsAt);
  if (body.title !== undefined) updateData.title = body.title;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.headcount !== undefined) updateData.headcount = Math.max(1, body.headcount);
  if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;

  const newStartsAt = updateData.startsAt;
  const newEndsAt = updateData.endsAt;
  const requiredSkillIds = body.requiredSkillIds;

  if (newStartsAt && newEndsAt && newEndsAt <= newStartsAt) {
    return NextResponse.json(
      { code: "INVALID_RANGE", message: "endsAt must be after startsAt" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({
        where: { id },
        include: {
          location: { select: { id: true, timezone: true } },
          requiredSkills: { select: { skillId: true } },
          assignments: {
            include: {
              shift: { select: { startsAt: true, endsAt: true } },
              user: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!shift) {
        return { success: false as const, error: "NOT_FOUND" };
      }

      if (updateData.headcount != null && updateData.headcount < shift.assignments.length) {
        return {
          success: false as const,
          error: "INVALID_HEADCOUNT" as const,
          details: {
            message: `Cannot set headcount to ${updateData.headcount}: ${shift.assignments.length} staff are already assigned.`,
          },
        };
      }

      const timesOrSkillsChanged =
        newStartsAt != null ||
        newEndsAt != null ||
        requiredSkillIds !== undefined;
      const unpublishing = body.isPublished === false;

      if ((timesOrSkillsChanged || unpublishing) && !canUnpublishOrEdit(shift.startsAt)) {
        return {
          success: false as const,
          error: "CUTOFF_PASSED",
          message:
            "Cannot edit or unpublish: shift is within the cutoff window (default 48 hours before start).",
        };
      }

      const effectiveStartsAt = newStartsAt ?? shift.startsAt;
      const effectiveEndsAt = newEndsAt ?? shift.endsAt;
      const effectiveSkillIds =
        requiredSkillIds ?? shift.requiredSkills.map((s) => s.skillId);

      if (timesOrSkillsChanged && shift.assignments.length > 0) {
        const policyShift: PolicyShift = {
          id: shift.id,
          locationId: shift.locationId,
          startsAt: effectiveStartsAt,
          endsAt: effectiveEndsAt,
          requiredSkillIds: effectiveSkillIds,
        };

        for (const assignment of shift.assignments) {
          const userId = assignment.userId;
          const excludeAssignmentId = assignment.id;

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
                skillId: { in: effectiveSkillIds },
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

          const policyAssignments = userAssignments.map(toPolicyAssignment);
          const weekStart = getWeekStart(effectiveStartsAt);
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
            skillsByUser.set(s.userId, {
              user: s.user,
              skillIds: [...new Set(skillIds)],
            });
          }
          const usersWithAllSkills = Array.from(skillsByUser.entries())
            .filter(([, { skillIds }]) =>
              effectiveSkillIds.every((rid) => skillIds.includes(rid))
            )
            .map(([, { user, skillIds }]) => ({ ...user, skillIds }));

          const usersWithCerts = Array.from(
            new Map(
              allCertsForLocation.map((c) => [
                c.user.id,
                {
                  id: c.user.id,
                  name: c.user.name,
                  email: c.user.email,
                  hasValidCert: true,
                },
              ])
            ).values()
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
            allUsersWithLocationCerts: usersWithCerts,
            allUsersWithAvailability: usersWithCerts.map((u) => ({
              ...u,
              hasAvailability: true,
            })),
            excludeAssignmentId,
            now: new Date(),
          });

          if (!validation.valid) {
            const firstBlock = validation.blocks[0];
            return {
              success: false as const,
              error: "VALIDATION_FAILED" as const,
              details: {
                blocks: validation.blocks,
                warnings: validation.warnings,
                userId,
                userName: assignment.user?.name ?? "Unknown",
                message:
                  firstBlock?.message ??
                  "Edit would violate constraints for assigned staff",
              },
            };
          }
        }
      }

      const updatedShift = await tx.shift.update({
        where: { id },
        data: {
          ...updateData,
          ...(requiredSkillIds !== undefined && {
            requiredSkills: {
              deleteMany: {},
              create: requiredSkillIds.map((skillId) => ({ skillId })),
            },
          }),
        },
        include: {
          requiredSkills: { include: { skill: { select: { id: true, name: true } } } },
        },
      });

      const assignmentsForShift = await tx.shiftAssignment.findMany({
        where: { shiftId: id },
        select: { id: true },
      });
      const assignmentIds = assignmentsForShift.map((a) => a.id);

      if (assignmentIds.length > 0) {
        const affectedSwaps = await tx.swapRequest.findMany({
          where: {
            status: { in: ["PENDING", "PENDING_MANAGER"] },
            OR: [
              { initiatorShiftId: { in: assignmentIds } },
              { receiverShiftId: { in: assignmentIds } },
            ],
          },
        });

        for (const swap of affectedSwaps) {
          const transitionResult = transition(
            fromPrismaStatus(swap.status),
            SwapEvent.SHIFT_EDITED,
            {
              initiatorId: swap.initiatorId,
              receiverId: swap.receiverId,
              actorId: "system",
              requiresManagerApproval: false,
            }
          );
          if (transitionResult.success && transitionResult.newState) {
            await tx.swapRequest.update({
              where: { id: swap.id },
              data: { status: toPrismaStatus(transitionResult.newState) },
            });
            for (const n of transitionResult.notifications) {
              const userId =
                n.target === "initiator"
                  ? swap.initiatorId
                  : n.target === "receiver"
                    ? swap.receiverId
                    : null;
              if (userId) {
                await tx.notification.create({
                  data: {
                    userId,
                    type: n.type as NotificationType,
                    title: n.title,
                    body: n.body ?? null,
                    data: (n.data ?? {}) as object,
                  },
                });
              }
            }
          }
        }
      }

      if (session?.user?.id) {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: "SHIFT_EDITED",
            entityType: "Shift",
            entityId: id,
            locationId: shift.locationId,
            changes: {
              before: {
                startsAt: shift.startsAt.toISOString(),
                endsAt: shift.endsAt.toISOString(),
                title: shift.title,
                notes: shift.notes,
                isPublished: shift.isPublished,
                requiredSkillIds: shift.requiredSkills.map((s) => s.skillId),
              },
              after: {
                startsAt: updatedShift.startsAt.toISOString(),
                endsAt: updatedShift.endsAt.toISOString(),
                title: updatedShift.title,
                notes: updatedShift.notes,
                isPublished: updatedShift.isPublished,
                requiredSkillIds: updatedShift.requiredSkills.map(
                  (s) => s.skill.id
                ),
              },
            },
          },
        });
      }

      return {
        success: true as const,
        shift,
        updated: updatedShift,
      };
    });

    if (!result.success) {
      if (result.error === "NOT_FOUND") {
        return NextResponse.json(
          { code: "NOT_FOUND", message: "Shift not found" },
          { status: 404 }
        );
      }
      if (result.error === "INVALID_HEADCOUNT") {
        return NextResponse.json(
          { code: "INVALID_HEADCOUNT", message: result.details?.message ?? "Invalid headcount" },
          { status: 400 }
        );
      }
      if (result.error === "CUTOFF_PASSED") {
        return NextResponse.json(
          {
            code: "CUTOFF_PASSED",
            message:
              result.message ??
              "Cannot edit or unpublish: shift is within the cutoff window (default 48 hours before start).",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          code: "VALIDATION_FAILED",
          message:
            result.details?.message ??
            "Edit would violate constraints for assigned staff",
          details: result.details,
        },
        { status: 422 }
      );
    }

    const { shift, updated } = result;

    await broadcastShiftEdited(shift.locationId, {
      shiftId: id,
      locationId: shift.locationId,
      updatedAt: updated.updatedAt.toISOString(),
    });

    return NextResponse.json({
      shift: {
        id: updated.id,
        locationId: updated.locationId,
        startsAt: updated.startsAt.toISOString(),
        endsAt: updated.endsAt.toISOString(),
        title: updated.title,
        notes: updated.notes,
        headcount: updated.headcount,
        isPublished: updated.isPublished,
        requiredSkills: updated.requiredSkills.map((ss) => ({
          id: ss.skill.id,
          name: ss.skill.name,
        })),
      },
    });
  } catch (err) {
    console.error("Shift update error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
