import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SwapEvent,
  transition,
  toPrismaStatus,
  fromPrismaStatus,
  getDefaultExpiration,
} from "@/lib/domain/swap-workflow";

/**
 * POST /api/swaps/reject
 * Manager rejects a pending swap.
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

  const session = await auth();
  if (!session?.user?.id || actorId !== session.user.id) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You can only reject as yourself" },
      { status: 403 }
    );
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Manager or admin access required" },
      { status: 403 }
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
        requiresManagerApproval: true,
        expiresAt,
      };

      const transitionResult = transition(
        fromPrismaStatus(swapRequest.status),
        SwapEvent.MANAGER_REJECT,
        context
      );

      if (!transitionResult.success || !transitionResult.newState) {
        return {
          success: false as const,
          error: {
            code: "TRANSITION_FAILED",
            message:
              transitionResult.error ??
              "Cannot reject: swap is not pending manager approval.",
          },
        };
      }

      const prismaStatus =
        transitionResult.prismaStatusOverride ?? toPrismaStatus(transitionResult.newState);

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
          action: "SWAP_REJECT",
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
    console.error("Swap reject error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
