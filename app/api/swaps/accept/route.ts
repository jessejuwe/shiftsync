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
import { executeSwap } from "@/lib/domain/swap-execute";

/**
 * POST /api/swaps/accept
 * Receiver accepts a swap request. If no manager approval required, executes swap.
 * Runs in transaction with constraint validation, notifications, and audit.
 */
export async function POST(request: NextRequest) {
  let body: { swapRequestId: string; actorId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { swapRequestId, actorId } = body;
  if (!swapRequestId || !actorId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "swapRequestId and actorId required" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const swapRequest = await tx.swapRequest.findUnique({
        where: { id: swapRequestId },
      });

      if (!swapRequest) {
        return {
          success: false as const,
          error: { code: "NOT_FOUND", message: "Swap request not found" },
        };
      }

      const expiresAt = getDefaultExpiration(swapRequest.createdAt);
      const context = {
        initiatorId: swapRequest.initiatorId,
        receiverId: swapRequest.receiverId,
        actorId,
        requiresManagerApproval: false,
        expiresAt,
      };

      let transitionResult = transition(
        fromPrismaStatus(swapRequest.status),
        SwapEvent.ACCEPT,
        context
      );

      if (!transitionResult.success || !transitionResult.newState) {
        return {
          success: false as const,
          error: {
            code: "TRANSITION_FAILED",
            message: transitionResult.error,
          },
        };
      }

      let newState = transitionResult.newState;

      if (
        newState === SwapState.ACCEPTED &&
        !context.requiresManagerApproval
      ) {
        const confirmResult = transition(newState, SwapEvent.CONFIRM, context);
        if (!confirmResult.success || !confirmResult.newState) {
          return {
            success: false as const,
            error: {
              code: "TRANSITION_FAILED",
              message:
                confirmResult.error ?? "Cannot auto-approve swap",
            },
          };
        }
        transitionResult = confirmResult;
        newState = confirmResult.newState;
      }

      const prismaStatus =
        transitionResult.prismaStatusOverride ?? toPrismaStatus(newState);

      await tx.swapRequest.update({
        where: { id: swapRequestId },
        data: { status: prismaStatus, respondedAt: new Date() },
      });

      for (const n of transitionResult.notifications) {
        const userId =
          n.target === "initiator" ? swapRequest.initiatorId : swapRequest.receiverId;
        const notificationType =
          n.type === "SWAP_ACCEPTED" || n.type === "SWAP_APPROVED"
            ? "SWAP_APPROVED"
            : "SWAP_REJECTED";
        await tx.notification.create({
          data: {
            userId,
            type: notificationType,
            title: n.title,
            body: n.body,
            data: (n.data ?? {}) as object,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "SWAP_ACCEPT",
          entityType: "SwapRequest",
          entityId: swapRequestId,
          changes: {
            previousStatus: swapRequest.status,
            newStatus: prismaStatus,
          },
        },
      });

      if (newState === SwapState.APPROVED) {
        const swapResult = await executeSwap(
          tx,
          {
            swapRequestId,
            initiatorId: swapRequest.initiatorId,
            receiverId: swapRequest.receiverId,
            initiatorShiftId: swapRequest.initiatorShiftId,
            receiverShiftId: swapRequest.receiverShiftId,
          },
          actorId
        );

        if (!swapResult.success) {
          return {
            success: false as const,
            error: {
              code: "VALIDATION_FAILED",
              message: swapResult.error,
              details: swapResult.validationBlocks,
            },
          };
        }
      }

      return {
        success: true as const,
        data: {
          swapRequest: {
            id: swapRequestId,
            status: prismaStatus,
            newState,
          },
        },
      };
    });

    if (!result.success) {
      const status =
        result.error.code === "NOT_FOUND"
          ? 404
          : result.error.code === "VALIDATION_FAILED"
            ? 422
            : 400;
      return NextResponse.json(
        {
          code: result.error.code,
          message: result.error.message,
          ...(result.error.details && { details: result.error.details }),
        },
        { status }
      );
    }

    if (result.data.swapRequest.newState === SwapState.APPROVED) {
      const swapRequest = await prisma.swapRequest.findUnique({
        where: { id: swapRequestId },
      });
      if (swapRequest) {
        await broadcastSwapApproved(
          swapRequest.initiatorId,
          swapRequest.receiverId,
          {
            swapRequestId,
            initiatorId: swapRequest.initiatorId,
            receiverId: swapRequest.receiverId,
          }
        );
      }
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("Swap accept error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
