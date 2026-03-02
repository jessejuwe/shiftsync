import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastShiftUnassigned } from "@/lib/pusher-events";
import {
  SwapEvent,
  transition,
  toPrismaStatus,
  fromPrismaStatus,
} from "@/lib/domain/swap-workflow";

/**
 * DELETE /api/shifts/assignments/[id]
 * Remove a staff member from a shift (call-out, coverage change).
 * Auto-cancels pending swap requests that reference this assignment.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.shiftAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          shift: { select: { id: true, locationId: true } },
        },
      });

      if (!assignment) {
        return {
          success: false as const,
          error: { code: "NOT_FOUND", message: "Assignment not found" },
        };
      }

      // Auto-cancel pending swap requests that reference this assignment
      const affectedSwaps = await tx.swapRequest.findMany({
        where: {
          status: "PENDING",
          OR: [
            { initiatorShiftId: assignmentId },
            { receiverShiftId: assignmentId },
          ],
        },
      });

      for (const swap of affectedSwaps) {
        const transitionResult = transition(
          fromPrismaStatus(swap.status),
          SwapEvent.SHIFT_EDITED,
          {
            initiatorId: swap.initiatorId,
            receiverId: swap.receiverId,
            actorId: "system",
            requiresManagerApproval: false,
          }
        );
        if (transitionResult.success && transitionResult.newState) {
          await tx.swapRequest.update({
            where: { id: swap.id },
            data: { status: toPrismaStatus(transitionResult.newState) },
          });
          for (const n of transitionResult.notifications) {
            const userId =
              n.target === "initiator" ? swap.initiatorId : swap.receiverId;
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
        }
      }

      await tx.shiftAssignment.delete({
        where: { id: assignmentId },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "SHIFT_UNASSIGNED",
          entityType: "ShiftAssignment",
          entityId: assignmentId,
          locationId: assignment.shift.locationId,
          changes: {
            before: {
              shiftId: assignment.shiftId,
              userId: assignment.userId,
            },
            after: null,
          },
        },
      });

      return {
        success: true as const,
        data: {
          assignmentId,
          shiftId: assignment.shiftId,
          userId: assignment.userId,
          locationId: assignment.shift.locationId,
        },
      };
    });

    if (!result.success) {
      return NextResponse.json(
        { code: result.error.code, message: result.error.message },
        { status: 404 }
      );
    }

    void broadcastShiftUnassigned(
      result.data.userId,
      result.data.locationId,
      {
        assignmentId: result.data.assignmentId,
        shiftId: result.data.shiftId,
        userId: result.data.userId,
        locationId: result.data.locationId,
      }
    );

    return NextResponse.json({
      success: true,
      assignmentId: result.data.assignmentId,
      shiftId: result.data.shiftId,
    });
  } catch (err) {
    console.error("Shift unassign error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
