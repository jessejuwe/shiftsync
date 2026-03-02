import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/notifications/[id]
 * Mark a notification as read.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const existing = await prisma.notification.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Notification not found" },
      { status: 404 }
    );
  }

  if (existing.readAt) {
    return NextResponse.json({
      notification: {
        id: existing.id,
        readAt: existing.readAt.toISOString(),
      },
    });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({
    notification: {
      id: updated.id,
      readAt: updated.readAt?.toISOString() ?? null,
    },
  });
}
