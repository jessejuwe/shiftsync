import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/notifications?unreadOnly=true
 * List notifications for the current user.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const where = {
    userId: session.user.id,
    ...(unreadOnly && { readAt: null }),
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = unreadOnly
    ? notifications.length
    : await prisma.notification.count({
        where: { userId: session.user.id, readAt: null },
      });

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
