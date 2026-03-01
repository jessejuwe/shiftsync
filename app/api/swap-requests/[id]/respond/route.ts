import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastSwapApproved } from "@/lib/pusher-events";
import {
  SwapState,
  SwapEvent,
  transition,
  toPrismaStatus,
  fromPrismaStatus,
  getDefaultExpiration,
} from "@/lib/domain/swap-workflow";

/**
 * POST /api/swap-requests/[id]/respond
 * Respond to a swap request (accept/reject) and broadcast when approved.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { action: "accept" | "reject"; actorId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { action, actorId } = body;
  if (!action || !actorId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "action and actorId required" },
      { status: 400 }
    );
  }

  const swapRequest = await prisma.swapRequest.findUnique({
    where: { id },
  });

  if (!swapRequest) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Swap request not found" },
      { status: 404 }
    );
  }

  const expiresAt = getDefaultExpiration(swapRequest.createdAt);
  const context = {
    initiatorId: swapRequest.initiatorId,
    receiverId: swapRequest.receiverId,
    actorId,
    requiresManagerApproval: false,
    expiresAt,
  };

  let result = transition(
    fromPrismaStatus(swapRequest.status),
    action === "accept" ? SwapEvent.ACCEPT : SwapEvent.REJECT,
    context
  );

  if (!result.success || !result.newState) {
    return NextResponse.json(
      { code: "TRANSITION_FAILED", message: result.error },
      { status: 400 }
    );
  }

  // If accepted and no manager approval, auto-confirm to APPROVED
  let newState = result.newState;
  if (
    action === "accept" &&
    newState === "ACCEPTED" &&
    !context.requiresManagerApproval
  ) {
    const confirmResult = transition(newState, SwapEvent.CONFIRM, context);
    if (confirmResult.success && confirmResult.newState) {
      result = confirmResult;
      newState = confirmResult.newState;
    }
  }

  const prismaStatus = result.prismaStatusOverride ?? toPrismaStatus(newState!);

  await prisma.swapRequest.update({
    where: { id },
    data: {
      status: prismaStatus,
      respondedAt: new Date(),
    },
  });

  if (newState === SwapState.APPROVED) {
    await broadcastSwapApproved(
      swapRequest.initiatorId,
      swapRequest.receiverId,
      {
        swapRequestId: id,
        initiatorId: swapRequest.initiatorId,
        receiverId: swapRequest.receiverId,
      }
    );
  }

  return NextResponse.json({
    swapRequest: {
      id,
      status: prismaStatus,
      newState: result.newState,
    },
  });
}
