import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastSwapRequested } from "@/lib/pusher-events";
import {
  SwapState,
  SwapEvent,
  transition,
  toPrismaStatus,
  canCreateSwap,
  getDefaultExpiration,
} from "@/lib/domain/swap-workflow";

/**
 * POST /api/swap-requests
 * Create a swap request and broadcast to receiver.
 */
export async function POST(request: NextRequest) {
  let body: {
    initiatorId: string;
    receiverId: string;
    initiatorShiftId: string;
    receiverShiftId?: string;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { initiatorId, receiverId, initiatorShiftId, receiverShiftId, message } = body;
  if (!initiatorId || !receiverId || !initiatorShiftId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "initiatorId, receiverId, initiatorShiftId required" },
      { status: 400 }
    );
  }

  const initiatorShift = await prisma.shiftAssignment.findUnique({
    where: { id: initiatorShiftId },
    include: { shift: true },
  });

  if (!initiatorShift || initiatorShift.userId !== initiatorId) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Initiator shift not found" },
      { status: 404 }
    );
  }

  // Enforce max 3 pending swaps per staff (count initiator's pending)
  const initiatorPendingCount = await prisma.swapRequest.count({
    where: {
      initiatorId,
      status: "PENDING",
    },
  });
  const initiatorCheck = canCreateSwap(initiatorPendingCount);
  if (!initiatorCheck.valid) {
    return NextResponse.json(
      { code: "MAX_PENDING_SWAPS", message: initiatorCheck.error },
      { status: 422 }
    );
  }

  const receiverPendingCount = await prisma.swapRequest.count({
    where: {
      receiverId,
      status: "PENDING",
    },
  });
  const receiverCheck = canCreateSwap(receiverPendingCount);
  if (!receiverCheck.valid) {
    return NextResponse.json(
      { code: "MAX_PENDING_SWAPS", message: "Receiver has too many pending swap requests." },
      { status: 422 }
    );
  }

  const createdAt = new Date();
  const expiresAt = getDefaultExpiration(createdAt);

  const result = transition(
    SwapState.ACTIVE,
    SwapEvent.SEND,
    {
      initiatorId,
      receiverId,
      actorId: initiatorId,
      requiresManagerApproval: false,
      expiresAt,
      now: createdAt,
    }
  );

  if (!result.success || !result.newState) {
    return NextResponse.json(
      { code: "TRANSITION_FAILED", message: result.error },
      { status: 400 }
    );
  }

  const swapRequest = await prisma.swapRequest.create({
    data: {
      initiatorId,
      receiverId,
      initiatorShiftId,
      receiverShiftId,
      message,
      status: toPrismaStatus(result.newState),
    },
  });

  await broadcastSwapRequested(receiverId, {
    swapRequestId: swapRequest.id,
    initiatorId,
    receiverId,
    initiatorShiftId,
    receiverShiftId,
  });

  return NextResponse.json(
    {
      swapRequest: {
        id: swapRequest.id,
        status: swapRequest.status,
        initiatorId,
        receiverId,
      },
    },
    { status: 201 }
  );
}
