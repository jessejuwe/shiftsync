import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";

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
 * POST /api/swaps/request
 * Create a swap request. Runs in transaction with notifications and audit.
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
      { status: 400 },
    );
  }

  const {
    initiatorId,
    receiverId,
    initiatorShiftId,
    receiverShiftId,
    message,
  } = body;
  if (!initiatorId || !receiverId || !initiatorShiftId) {
    return NextResponse.json(
      {
        code: "MISSING_FIELDS",
        message: "initiatorId, receiverId, initiatorShiftId required",
      },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const initiatorShift = await tx.shiftAssignment.findUnique({
        where: { id: initiatorShiftId },
        include: { shift: true },
      });

      if (!initiatorShift || initiatorShift.userId !== initiatorId) {
        return {
          success: false as const,
          error: {
            code: "NOT_FOUND",
            message: "Initiator shift not found",
          },
        };
      }

      if (receiverShiftId) {
        const receiverShift = await tx.shiftAssignment.findUnique({
          where: { id: receiverShiftId },
        });
        if (!receiverShift || receiverShift.userId !== receiverId) {
          return {
            success: false as const,
            error: {
              code: "NOT_FOUND",
              message: "Receiver shift not found or does not belong to receiver",
            },
          };
        }
      }

      const initiatorPendingCount = await tx.swapRequest.count({
        where: { initiatorId, status: "PENDING" },
      });
      if (!canCreateSwap(initiatorPendingCount).valid) {
        return {
          success: false as const,
          error: {
            code: "MAX_PENDING_SWAPS",
            message: canCreateSwap(initiatorPendingCount).error,
          },
        };
      }

      const receiverPendingCount = await tx.swapRequest.count({
        where: { receiverId, status: "PENDING" },
      });
      if (!canCreateSwap(receiverPendingCount).valid) {
        return {
          success: false as const,
          error: {
            code: "MAX_PENDING_SWAPS",
            message: "Receiver has too many pending swap requests.",
          },
        };
      }

      const createdAt = new Date();
      const expiresAt = getDefaultExpiration(createdAt);

      const transitionResult = transition(SwapState.ACTIVE, SwapEvent.SEND, {
        initiatorId,
        receiverId,
        actorId: initiatorId,
        requiresManagerApproval: false,
        expiresAt,
        now: createdAt,
      });

      if (!transitionResult.success || !transitionResult.newState) {
        return {
          success: false as const,
          error: {
            code: "TRANSITION_FAILED",
            message: transitionResult.error,
          },
        };
      }

      const swapRequest = await tx.swapRequest.create({
        data: {
          initiatorId,
          receiverId,
          initiatorShiftId,
          receiverShiftId,
          message,
          status: toPrismaStatus(transitionResult.newState),
        },
      });

      for (const n of transitionResult.notifications) {
        const userId = n.target === "receiver" ? receiverId : initiatorId;
        await tx.notification.create({
          data: {
            userId,
            type: "SWAP_REQUEST",
            title: n.title,
            body: n.body,
            data: (n.data ?? {}) as Prisma.InputJsonValue,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: initiatorId,
          action: "SWAP_REQUEST",
          entityType: "SwapRequest",
          entityId: swapRequest.id,
          changes: {
            initiatorShiftId,
            receiverShiftId,
            receiverId,
          },
        },
      });

      return {
        success: true as const,
        data: {
          swapRequest: {
            id: swapRequest.id,
            status: swapRequest.status,
            initiatorId,
            receiverId,
          },
        },
      };
    });

    if (!result.success) {
      const status =
        result.error.code === "NOT_FOUND"
          ? 404
          : result.error.code === "MAX_PENDING_SWAPS"
            ? 422
            : 400;
      return NextResponse.json(
        { code: result.error.code, message: result.error.message },
        { status },
      );
    }

    await broadcastSwapRequested(receiverId, {
      swapRequestId: result.data.swapRequest.id,
      initiatorId,
      receiverId,
      initiatorShiftId,
      receiverShiftId,
    });

    return NextResponse.json(result.data, { status: 201 });
  } catch (err) {
    console.error("Swap request error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
