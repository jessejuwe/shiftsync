import { NextRequest, NextResponse } from "next/server";
import { AuditLogAction } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  broadcastSwapApproved,
  broadcastShiftAssigned,
} from "@/lib/pusher-events";
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
 * POST /api/swaps/approve
 * Manager approves a pending swap, or receiver confirms when no manager approval.
 * Runs in transaction with constraint validation, notifications, and audit.
 */
export async function POST(request: NextRequest) {
  let body: { swapRequestId: string; actorId: string; overrideReason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 },
    );
  }

  const { swapRequestId, actorId, overrideReason } = body;
  if (!swapRequestId || !actorId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "swapRequestId and actorId required" },
      { status: 400 },
    );
  }

  const session = await auth();
  if (!session?.user?.id || actorId !== session.user.id) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You can only approve as yourself" },
      { status: 403 },
    );
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Manager or admin access required" },
      { status: 403 },
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

      const expiresAt = getSwapRequestExpiration({
        initiatorShiftStartsAt: swapRequest.initiatorShift.shift.startsAt,
        receiverShiftId: swapRequest.receiverShiftId,
        createdAt: swapRequest.createdAt,
      });
      const context = {
        initiatorId: swapRequest.initiatorId,
        receiverId: swapRequest.receiverId,
        actorId,
        requiresManagerApproval: false,
        expiresAt,
      };

      const currentState = fromPrismaStatus(swapRequest.status);

      // CONFIRM is only valid from ACCEPTED; MANAGER_APPROVE only from PENDING_MANAGER.
      // REQUESTED (Prisma PENDING before receiver accepts) has neither - reject explicitly.
      if (currentState === SwapState.REQUESTED) {
        return {
          success: false as const,
          error: {
            code: "TRANSITION_FAILED",
            message:
              "Cannot approve: swap has not been accepted yet. The receiver must accept the swap first.",
          },
        };
      }

      // Idempotent: already approved (e.g. double-click or another manager approved)
      if (currentState === SwapState.APPROVED) {
        return {
          success: true as const,
          data: {
            swapRequest: {
              id: swapRequestId,
              status: swapRequest.status,
              newState: SwapState.APPROVED,
            },
          },
        };
      }

      const event =
        currentState === SwapState.PENDING_MANAGER
          ? SwapEvent.MANAGER_APPROVE
          : SwapEvent.CONFIRM;

      const transitionResult = transition(currentState, event, context);

      if (!transitionResult.success || !transitionResult.newState) {
        return {
          success: false as const,
          error: {
            code: "TRANSITION_FAILED",
            message: transitionResult.error,
          },
        };
      }

      const newState = transitionResult.newState;
      const prismaStatus =
        transitionResult.prismaStatusOverride ?? toPrismaStatus(newState);

      // Run executeSwap BEFORE updating status/notifications so that validation
      // failures roll back the transaction without sending "Swap Approved" to users.
      if (newState === SwapState.APPROVED) {
        const swapResult = await executeSwap(
          tx,
          {
            swapRequestId,
            initiatorId: swapRequest.initiatorId,
            receiverId: swapRequest.receiverId,
            initiatorShiftId: swapRequest.initiatorShiftId,
            receiverShiftId: swapRequest.receiverShiftId,
            ...(overrideReason?.trim() && { overrideReason: overrideReason.trim() }),
          },
          actorId,
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
          n.target === "initiator"
            ? swapRequest.initiatorId
            : n.target === "receiver"
              ? swapRequest.receiverId
              : null;
        if (userId) {
          await tx.notification.create({
            data: {
              userId,
              type: "SWAP_APPROVED",
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
          action: AuditLogAction.SWAP_APPROVE,
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
        { status },
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
          },
        );
        // Broadcast to schedule channels so UI shows updated assignments
        await broadcastShiftAssigned(
          swapRequest.receiverId,
          swapRequest.initiatorShift.shift.locationId,
          {
            assignmentId: swapRequest.initiatorShiftId,
            shiftId: swapRequest.initiatorShift.shift.id,
          },
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
              },
            );
          }
        }
      }
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("Swap approve error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
