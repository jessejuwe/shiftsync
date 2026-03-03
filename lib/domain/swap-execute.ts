/**
 * Swap execution - validates and performs assignment swaps.
 * Used when a swap is APPROVED (accept or manager approve).
 */

import type { PrismaClient } from "@/generated/prisma/client";
import {
  validateShiftAssignment,
  type PolicyShift,
  type PolicyAssignment,
} from "./shift-policy";

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

export interface SwapExecuteInput {
  swapRequestId: string;
  initiatorId: string;
  receiverId: string;
  initiatorShiftId: string;
  receiverShiftId: string | null;
  /** When provided, allows override of 7th consecutive day block for receiver or initiator */
  overrideReason?: string;
}

export interface SwapExecuteResult {
  success: boolean;
  error?: string;
  validationBlocks?: Array<{
    type: string;
    message: string;
    code?: string;
    metadata?: { requiresOverride?: boolean };
  }>;
}

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Validate and execute a swap. Runs inside a transaction.
 * 1. Validates receiver can take initiatorShift (excluding receiverShift from their assignments)
 * 2. Validates initiator can take receiverShift (excluding initiatorShift, if receiverShift exists)
 * 3. Updates assignments
 * 4. Creates notifications
 * 5. Creates audit log entries
 */
export async function executeSwap(
  tx: TxClient,
  input: SwapExecuteInput,
  actorId: string,
): Promise<SwapExecuteResult> {
  const {
    swapRequestId,
    initiatorId,
    receiverId,
    initiatorShiftId,
    receiverShiftId,
    overrideReason,
  } = input;

  const initiatorAssignment = await tx.shiftAssignment.findUnique({
    where: { id: initiatorShiftId },
    include: {
      shift: {
        include: { requiredSkills: { select: { skillId: true } } },
      },
    },
  });

  if (!initiatorAssignment || initiatorAssignment.userId !== initiatorId) {
    return { success: false, error: "Initiator shift not found or invalid" };
  }

  const initiatorShift = initiatorAssignment.shift;
  const initiatorShiftPolicy: PolicyShift = {
    id: initiatorShift.id,
    locationId: initiatorShift.locationId,
    startsAt: initiatorShift.startsAt,
    endsAt: initiatorShift.endsAt,
    requiredSkillIds: initiatorShift.requiredSkills.map((s) => s.skillId),
  };

  type AssignmentWithShift = {
    id: string;
    userId: string;
    shiftId: string;
    shift: {
      id: string;
      locationId: string;
      startsAt: Date;
      endsAt: Date;
      requiredSkills: { skillId: string }[];
    };
  };

  let receiverShiftPolicy: PolicyShift | null = null;
  let receiverAssignment: AssignmentWithShift | null = null;
  if (receiverShiftId) {
    const found = await tx.shiftAssignment.findUnique({
      where: { id: receiverShiftId },
      include: {
        shift: {
          include: { requiredSkills: { select: { skillId: true } } },
        },
      },
    });
    if (!found || found.userId !== receiverId) {
      return { success: false, error: "Receiver shift not found or invalid" };
    }
    receiverAssignment = found as AssignmentWithShift;
    receiverShiftPolicy = {
      id: receiverAssignment.shift.id,
      locationId: receiverAssignment.shift.locationId,
      startsAt: receiverAssignment.shift.startsAt,
      endsAt: receiverAssignment.shift.endsAt,
      requiredSkillIds: receiverAssignment.shift.requiredSkills.map(
        (s) => s.skillId,
      ),
    };
  }

  const now = new Date();

  // Fetch all data for validation
  const [
    receiverAssignments,
    receiverSkills,
    receiverCerts,
    receiverAvailability,
    initiatorAssignments,
    initiatorSkills,
    initiatorCerts,
    initiatorAvailability,
    allStaffSkillsInitiatorShift,
    allCertsInitiatorLocation,
    allStaffSkillsReceiverShift,
    allCertsReceiverLocation,
  ] = await Promise.all([
    tx.shiftAssignment.findMany({
      where: { userId: receiverId },
      include: { shift: { select: { startsAt: true, endsAt: true } } },
    }),
    tx.staffSkill.findMany({
      where: { userId: receiverId },
      select: { skillId: true },
    }),
    tx.certification.findMany({
      where: { userId: receiverId },
      select: { locationId: true, expiresAt: true },
    }),
    tx.availabilityWindow.findMany({
      where: {
        userId: receiverId,
        locationId: initiatorShift.locationId,
      },
      select: {
        startsAt: true,
        endsAt: true,
        locationId: true,
        dayOfWeek: true,
        isRecurring: true,
      },
    }),
    tx.shiftAssignment.findMany({
      where: { userId: initiatorId },
      include: { shift: { select: { startsAt: true, endsAt: true } } },
    }),
    tx.staffSkill.findMany({
      where: { userId: initiatorId },
      select: { skillId: true },
    }),
    tx.certification.findMany({
      where: { userId: initiatorId },
      select: { locationId: true, expiresAt: true },
    }),
    receiverAssignment
      ? tx.availabilityWindow.findMany({
          where: {
            userId: initiatorId,
            locationId: receiverAssignment.shift.locationId,
          },
          select: {
            startsAt: true,
            endsAt: true,
            locationId: true,
            dayOfWeek: true,
            isRecurring: true,
          },
        })
      : [],
    tx.staffSkill.findMany({
      where: {
        skillId: { in: initiatorShiftPolicy.requiredSkillIds },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    tx.certification.findMany({
      where: {
        locationId: initiatorShift.locationId,
        expiresAt: { gt: now },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    receiverShiftPolicy
      ? tx.staffSkill.findMany({
          where: {
            skillId: { in: receiverShiftPolicy.requiredSkillIds },
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        })
      : [],
    receiverAssignment
      ? tx.certification.findMany({
          where: {
            locationId: receiverAssignment.shift.locationId,
            expiresAt: { gt: now },
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        })
      : [],
  ]);

  // Validate receiver can take initiatorShift (exclude receiverShift from their assignments)
  const receiverAssignmentsFiltered = receiverAssignments.filter(
    (a) => !receiverShiftId || a.id !== receiverShiftId,
  );
  const receiverPolicyAssignments =
    receiverAssignmentsFiltered.map(toPolicyAssignment);
  const weekStartR = getWeekStart(initiatorShift.startsAt);
  const weekEndR = new Date(weekStartR);
  weekEndR.setUTCDate(weekEndR.getUTCDate() + 6);
  weekEndR.setUTCHours(23, 59, 59, 999);
  const receiverAssignmentsInWeek = receiverAssignmentsFiltered.filter((a) => {
    const s = a.shift.startsAt;
    return s >= weekStartR && s <= weekEndR;
  });

  const skillsByUserI = new Map<
    string,
    { user: { id: string; name: string; email: string }; skillIds: string[] }
  >();
  for (const s of allStaffSkillsInitiatorShift) {
    const existing = skillsByUserI.get(s.userId);
    const skillIds = existing ? [...existing.skillIds, s.skillId] : [s.skillId];
    skillsByUserI.set(s.userId, {
      user: s.user,
      skillIds: [...new Set(skillIds)],
    });
  }
  const usersWithAllSkillsI = Array.from(skillsByUserI.entries())
    .filter(
      ([uid, { skillIds }]) =>
        uid !== receiverId &&
        initiatorShiftPolicy.requiredSkillIds.every((rid) =>
          skillIds.includes(rid),
        ),
    )
    .map(([, { user, skillIds }]) => ({ ...user, skillIds }));
  const certUsersI = Array.from(
    new Map(
      allCertsInitiatorLocation
        .filter((c) => c.userId !== receiverId)
        .map((c) => [
          c.user.id,
          {
            id: c.user.id,
            name: c.user.name,
            email: c.user.email,
            hasValidCert: true,
          },
        ]),
    ).values(),
  );

  const receiverValidation = validateShiftAssignment({
    shift: initiatorShiftPolicy,
    userId: receiverId,
    userSkillIds: receiverSkills.map((s) => s.skillId),
    userCertifications: receiverCerts.map((c) => ({
      userId: receiverId,
      locationId: c.locationId,
      expiresAt: c.expiresAt,
    })),
    userAvailabilityWindows: receiverAvailability.map((w) => ({
      userId: receiverId,
      locationId: w.locationId,
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      dayOfWeek: w.dayOfWeek,
      isRecurring: w.isRecurring,
    })),
    userAssignments: receiverPolicyAssignments,
    userAssignmentsInWeek: receiverAssignmentsInWeek.map(toPolicyAssignment),
    allUsersWithSkills: usersWithAllSkillsI,
    allUsersWithLocationCerts: certUsersI,
    allUsersWithAvailability: certUsersI.map((u) => ({
      ...u,
      hasAvailability: true,
    })),
    excludeAssignmentId: receiverShiftId ?? undefined,
    now,
  });

  let used7thDayOverride = false;
  const canOverrideReceiver7thDay =
    !receiverValidation.valid &&
    receiverValidation.blocks.length === 1 &&
    receiverValidation.blocks[0].code === "CONSECUTIVE_DAYS_EXCEEDED" &&
    receiverValidation.blocks[0].metadata?.requiresOverride === true &&
    typeof overrideReason === "string" &&
    overrideReason.trim().length > 0;

  if (canOverrideReceiver7thDay) used7thDayOverride = true;

  if (!receiverValidation.valid && !canOverrideReceiver7thDay) {
    return {
      success: false,
      error: "Receiver cannot take initiator shift.",
      validationBlocks: receiverValidation.blocks.map((b) => ({
        type: b.type,
        message: b.message,
        code: b.code,
        metadata: b.metadata,
      })),
    };
  }

  // Validate initiator can take receiverShift (if exists)
  if (receiverShiftPolicy && receiverAssignment) {
    const initiatorAssignmentsFiltered = initiatorAssignments.filter(
      (a) => a.id !== initiatorShiftId,
    );
    const initiatorPolicyAssignments =
      initiatorAssignmentsFiltered.map(toPolicyAssignment);
    const weekStartI = getWeekStart(receiverAssignment.shift.startsAt);
    const weekEndI = new Date(weekStartI);
    weekEndI.setUTCDate(weekEndI.getUTCDate() + 6);
    weekEndI.setUTCHours(23, 59, 59, 999);
    const initiatorAssignmentsInWeek = initiatorAssignmentsFiltered.filter(
      (a) => {
        const s = a.shift.startsAt;
        return s >= weekStartI && s <= weekEndI;
      },
    );

    const skillsByUserR = new Map<
      string,
      { user: { id: string; name: string; email: string }; skillIds: string[] }
    >();
    for (const s of allStaffSkillsReceiverShift) {
      const existing = skillsByUserR.get(s.userId);
      const skillIds = existing
        ? [...existing.skillIds, s.skillId]
        : [s.skillId];
      skillsByUserR.set(s.userId, {
        user: s.user,
        skillIds: [...new Set(skillIds)],
      });
    }
    const usersWithAllSkillsR = Array.from(skillsByUserR.entries())
      .filter(
        ([uid, { skillIds }]) =>
          uid !== initiatorId &&
          receiverShiftPolicy!.requiredSkillIds.every((rid) =>
            skillIds.includes(rid),
          ),
      )
      .map(([, { user, skillIds }]) => ({ ...user, skillIds }));
    const certUsersR = Array.from(
      new Map(
        allCertsReceiverLocation
          .filter((c) => c.userId !== initiatorId)
          .map((c) => [
            c.user.id,
            {
              id: c.user.id,
              name: c.user.name,
              email: c.user.email,
              hasValidCert: true,
            },
          ]),
      ).values(),
    );

    const initiatorValidation = validateShiftAssignment({
      shift: receiverShiftPolicy,
      userId: initiatorId,
      userSkillIds: initiatorSkills.map((s) => s.skillId),
      userCertifications: initiatorCerts.map((c) => ({
        userId: initiatorId,
        locationId: c.locationId,
        expiresAt: c.expiresAt,
      })),
      userAvailabilityWindows: initiatorAvailability.map((w) => ({
        userId: initiatorId,
        locationId: w.locationId,
        startsAt: w.startsAt,
        endsAt: w.endsAt,
        dayOfWeek: w.dayOfWeek,
        isRecurring: w.isRecurring,
      })),
      userAssignments: initiatorPolicyAssignments,
      userAssignmentsInWeek: initiatorAssignmentsInWeek.map(toPolicyAssignment),
      allUsersWithSkills: usersWithAllSkillsR,
      allUsersWithLocationCerts: certUsersR,
      allUsersWithAvailability: certUsersR.map((u) => ({
        ...u,
        hasAvailability: true,
      })),
      excludeAssignmentId: initiatorShiftId,
      now,
    });

    const canOverrideInitiator7thDay =
      !initiatorValidation.valid &&
      initiatorValidation.blocks.length === 1 &&
      initiatorValidation.blocks[0].code === "CONSECUTIVE_DAYS_EXCEEDED" &&
      initiatorValidation.blocks[0].metadata?.requiresOverride === true &&
      typeof overrideReason === "string" &&
      overrideReason.trim().length > 0;

    if (canOverrideInitiator7thDay) used7thDayOverride = true;

    if (!initiatorValidation.valid && !canOverrideInitiator7thDay) {
      return {
        success: false,
        error: "Initiator cannot take receiver shift.",
        validationBlocks: initiatorValidation.blocks.map((b) => ({
          type: b.type,
          message: b.message,
          code: b.code,
          metadata: b.metadata,
        })),
      };
    }
  }

  // Execute swap: update assignments
  await tx.shiftAssignment.update({
    where: { id: initiatorShiftId },
    data: { userId: receiverId },
  });

  if (receiverShiftId && receiverAssignment) {
    await tx.shiftAssignment.update({
      where: { id: receiverShiftId },
      data: { userId: initiatorId },
    });
  }

  // Create notifications
  await tx.notification.createMany({
    data: [
      {
        userId: receiverId,
        type: "SHIFT_ASSIGNED",
        title: "Swap completed",
        body: "You have received a shift from a swap.",
        data: { shiftId: initiatorShift.id, assignmentId: initiatorShiftId },
      },
      {
        userId: initiatorId,
        type: "SHIFT_ASSIGNED",
        title: "Swap completed",
        body: receiverShiftId
          ? "You have received a shift from a swap."
          : "Your shift was successfully dropped.",
        data: receiverAssignment
          ? {
              shiftId: receiverAssignment.shift.id,
              assignmentId: receiverShiftId,
            }
          : { shiftId: initiatorShift.id, dropped: true },
      },
    ],
  });

  // Audit log
  const { AuditLogAction } = await import("@/generated/prisma/enums");
  await tx.auditLog.createMany({
    data: [
      {
        userId: actorId,
        action: AuditLogAction.SWAP_EXECUTE,
        entityType: "SwapRequest",
        entityId: swapRequestId,
        changes: {
          initiatorShiftId,
          receiverShiftId,
          initiatorId,
          receiverId,
          type: receiverShiftId ? "swap" : "drop",
          ...(used7thDayOverride && {
            override7thDay: true,
            overrideReason: overrideReason!.trim(),
          }),
        },
      },
    ],
  });

  return { success: true };
}
