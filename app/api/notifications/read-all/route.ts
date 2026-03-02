import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for the current user.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
