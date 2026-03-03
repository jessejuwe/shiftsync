import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/settings/notifications
 * Get current user's notification preference.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPreference: true },
  });

  if (!user) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    notificationPreference: user.notificationPreference,
  });
}

/**
 * PATCH /api/settings/notifications
 * Update current user's notification preference.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  let body: { notificationPreference?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { notificationPreference } = body;
  if (
    !notificationPreference ||
    !["IN_APP_ONLY", "IN_APP_AND_EMAIL"].includes(notificationPreference)
  ) {
    return NextResponse.json(
      {
        code: "INVALID_VALUE",
        message:
          "notificationPreference must be IN_APP_ONLY or IN_APP_AND_EMAIL",
      },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      notificationPreference:
        notificationPreference as "IN_APP_ONLY" | "IN_APP_AND_EMAIL",
    },
    select: { notificationPreference: true },
  });

  return NextResponse.json({
    notificationPreference: user.notificationPreference,
  });
}
