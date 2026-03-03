import { NextRequest, NextResponse } from "next/server";
import { AuditLogAction } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  broadcastSwapApproved,
  broadcastShiftAssigned,
} from "@/lib/pusher-events";
import { REQUIRES_MANAGER_APPROVAL } from "@/lib/swap-config";
import {
  SwapState,
  SwapEvent,
  transition,
  toPrismaStatus,
  fromPrismaStatus,
  getSwapRequestExpiration,
} from "@/lib/domain/swap-workflow";
import { executeSwap } from "@/lib/domain/swap-execute";

/**
 * POST /api/swaps/accept
 * Receiver accepts a swap request. If no manager approval required, executes swap.
 * Runs in transaction with constraint validation, notifications, and audit.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required" },
      { status: 401 }
    );
  }

  let body: { swapRequestId: string; actorId?: string };
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

      if (swapRequest.receiverId !== actorId) {
        return {
          success: false as const,
          error: {
            code: "FORBIDDEN",
            message: "Only the receiver can accept this swap request",
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

      // Run executeSwap BEFORE status/notifications so validation failures
      // don't send "Swap Approved" to users.
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
          action: AuditLogAction.SWAP_ACCEPT,
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
        include: {
          initiatorShift: {
            include: { shift: { select: { id: true, locationId: true } } },
          },
        },
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
        await broadcastShiftAssigned(
          swapRequest.receiverId,
          swapRequest.initiatorShift.shift.locationId,
          {
            assignmentId: swapRequest.initiatorShiftId,
            shiftId: swapRequest.initiatorShift.shift.id,
          }
        );
        if (swapRequest.receiverShiftId) {
          const receiverAssignment = await prisma.shiftAssignment.findUnique({
            where: { id: swapRequest.receiverShiftId },
            include: { shift: { select: { id: true, locationId: true } } },
          });
          if (receiverAssignment) {
            await broadcastShiftAssigned(
              swapRequest.initiatorId,
              receiverAssignment.shift.locationId,
              {
                assignmentId: swapRequest.receiverShiftId,
                shiftId: receiverAssignment.shift.id,
              }
            );
          }
        }
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
