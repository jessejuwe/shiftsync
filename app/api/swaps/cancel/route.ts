import { NextRequest, NextResponse } from "next/server";
import { AuditLogAction } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REQUIRES_MANAGER_APPROVAL } from "@/lib/swap-config";
import {
  SwapEvent,
  transition,
  toPrismaStatus,
  fromPrismaStatus,
  getSwapRequestExpiration,
} from "@/lib/domain/swap-workflow";

/**
 * POST /api/swaps/cancel
 * Initiator or receiver cancels a swap request.
 * Runs in transaction with notifications and audit.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required" },
      { status: 401 }
    );
  }

  let body: { swapRequestId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { swapRequestId } = body;
  const actorId = session.user.id;
  if (!swapRequestId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "swapRequestId required" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const swapRequest = await tx.swapRequest.findUnique({
        where: { id: swapRequestId },
        include: { initiatorShift: { include: { shift: { select: { startsAt: true } } } } },
      });

      if (!swapRequest) {
        return {
          success: false as const,
          error: { code: "NOT_FOUND", message: "Swap request not found" },
        };
      }

      if (
        swapRequest.initiatorId !== actorId &&
        swapRequest.receiverId !== actorId
      ) {
        return {
          success: false as const,
          error: {
            code: "FORBIDDEN",
            message: "Only the initiator or receiver can cancel this swap request",
          },
        };
      }

      const expiresAt = getSwapRequestExpiration({
        initiatorShiftStartsAt: swapRequest.initiatorShift.shift.startsAt,
        receiverShiftId: swapRequest.receiverShiftId,
        createdAt: swapRequest.createdAt,
      });
      const context = {
        initiatorId: swapRequest.initiatorId,
        receiverId: swapRequest.receiverId,
        actorId,
        requiresManagerApproval: REQUIRES_MANAGER_APPROVAL,
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
              type: "SWAP_CANCELLED",
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
          action: AuditLogAction.SWAP_CANCEL,
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
