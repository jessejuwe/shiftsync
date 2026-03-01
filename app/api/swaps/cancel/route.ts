import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SwapEvent,
  transition,
  toPrismaStatus,
  fromPrismaStatus,
  getDefaultExpiration,
} from "@/lib/domain/swap-workflow";

/**
 * POST /api/swaps/cancel
 * Initiator or receiver cancels a swap request.
 * Runs in transaction with notifications and audit.
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

      const transitionResult = transition(
        fromPrismaStatus(swapRequest.status),
        SwapEvent.CANCEL,
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

      const prismaStatus =
        transitionResult.prismaStatusOverride ??
        toPrismaStatus(transitionResult.newState);

      await tx.swapRequest.update({
        where: { id: swapRequestId },
        data: { status: prismaStatus },
      });

      for (const n of transitionResult.notifications) {
        const userId =
          n.target === "initiator"
            ? swapRequest.initiatorId
            : n.target === "receiver"
              ? swapRequest.receiverId
              : null;
        if (userId) {
          await tx.notification.create({
            data: {
              userId,
              type: "SWAP_REJECTED",
              title: n.title,
              body: n.body,
              data: (n.data ?? {}) as object,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "SWAP_CANCEL",
          entityType: "SwapRequest",
          entityId: swapRequestId,
          changes: {
            previousStatus: swapRequest.status,
            newStatus: prismaStatus,
          },
        },
      });

      return {
        success: true as const,
        data: {
          swapRequest: {
            id: swapRequestId,
            status: prismaStatus,
            newState: transitionResult.newState,
          },
        },
      };
    });

    if (!result.success) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json(
        { code: result.error.code, message: result.error.message },
        { status }
      );
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("Swap cancel error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
