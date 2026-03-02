import { NextRequest, NextResponse } from "next/server";
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
 * POST /api/swap-requests/[id]/respond
 * Respond to a swap request (accept/reject). When accepted and no manager approval,
 * executes swap, creates notifications and audit log. Runs in transaction.
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

  const session = await auth();
  if (!session?.user?.id || actorId !== session.user.id) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You can only respond to swap requests as yourself" },
      { status: 403 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const swapRequest = await tx.swapRequest.findUnique({
        where: { id },
        include: { initiatorShift: { include: { shift: { select: { startsAt: true } } } } },
      });

      if (!swapRequest) {
        return {
          success: false as const,
          error: { code: "NOT_FOUND", message: "Swap request not found" },
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
        action === "accept" ? SwapEvent.ACCEPT : SwapEvent.REJECT,
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
        action === "accept" &&
        newState === SwapState.ACCEPTED &&
        REQUIRES_MANAGER_APPROVAL
      ) {
        const approvalResult = transition(
          newState,
          SwapEvent.REQUEST_MANAGER_APPROVAL,
          context
        );
        if (!approvalResult.success || !approvalResult.newState) {
          return {
            success: false as const,
            error: {
              code: "TRANSITION_FAILED",
              message:
                approvalResult.error ?? "Cannot request manager approval",
            },
          };
        }
        transitionResult = approvalResult;
        newState = approvalResult.newState;
      } else if (
        action === "accept" &&
        newState === SwapState.ACCEPTED &&
        !REQUIRES_MANAGER_APPROVAL
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
            swapRequestId: id,
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

      // Handle "manager" notification target: notify all admins and managers
      for (const n of transitionResult.notifications) {
        if (n.target === "manager") {
          const managers = await tx.user.findMany({
            where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
            select: { id: true },
          });
          for (const m of managers) {
            await tx.notification.create({
              data: {
                userId: m.id,
                type: "SWAP_PENDING_APPROVAL",
                title: n.title,
                body: n.body,
                data: (n.data ?? {}) as object,
              },
            });
          }
        } else {
          const userId =
            n.target === "initiator" ? swapRequest.initiatorId : swapRequest.receiverId;
          const notificationType =
            n.type === "SWAP_ACCEPTED" || n.type === "SWAP_APPROVED"
              ? "SWAP_APPROVED"
              : n.type === "SWAP_PENDING_APPROVAL"
                ? "SWAP_PENDING_APPROVAL"
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
      }

      await tx.swapRequest.update({
        where: { id },
        data: { status: prismaStatus, respondedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: action === "accept" ? "SWAP_ACCEPT" : "SWAP_REJECT",
          entityType: "SwapRequest",
          entityId: id,
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
            id,
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
        where: { id },
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
            swapRequestId: id,
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
    console.error("Swap respond error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
