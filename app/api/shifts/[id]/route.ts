import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastShiftEdited } from "@/lib/pusher-events";
import {
  SwapEvent,
  transition,
  toPrismaStatus,
  fromPrismaStatus,
} from "@/lib/domain/swap-workflow";

/**
 * PATCH /api/shifts/[id]
 * Update a shift and broadcast to schedule subscribers.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: {
    startsAt?: string;
    endsAt?: string;
    title?: string;
    notes?: string;
    isPublished?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const shift = await prisma.shift.findUnique({
    where: { id },
  });

  if (!shift) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Shift not found" },
      { status: 404 }
    );
  }

  const updateData: {
    startsAt?: Date;
    endsAt?: Date;
    title?: string;
    notes?: string;
    isPublished?: boolean;
  } = {};

  if (body.startsAt != null) updateData.startsAt = new Date(body.startsAt);
  if (body.endsAt != null) updateData.endsAt = new Date(body.endsAt);
  if (body.title !== undefined) updateData.title = body.title;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;

  const updated = await prisma.shift.update({
    where: { id },
    data: updateData,
  });

  // Auto-cancel swap requests that reference this shift
  const assignmentsForShift = await prisma.shiftAssignment.findMany({
    where: { shiftId: id },
    select: { id: true },
  });
  const assignmentIds = assignmentsForShift.map((a) => a.id);

  if (assignmentIds.length > 0) {
    const affectedSwaps = await prisma.swapRequest.findMany({
      where: {
        status: "PENDING",
        OR: [
          { initiatorShiftId: { in: assignmentIds } },
          { receiverShiftId: { in: assignmentIds } },
        ],
      },
    });

    for (const swap of affectedSwaps) {
      const result = transition(
        fromPrismaStatus(swap.status),
        SwapEvent.SHIFT_EDITED,
        {
          initiatorId: swap.initiatorId,
          receiverId: swap.receiverId,
          actorId: "system",
          requiresManagerApproval: false,
        }
      );
      if (result.success && result.newState) {
        await prisma.swapRequest.update({
          where: { id: swap.id },
          data: { status: toPrismaStatus(result.newState) },
        });
      }
    }
  }

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
      isPublished: updated.isPublished,
    },
  });
}
