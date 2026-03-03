import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/settings/desired-hours
 * Get current user's desired hours per week.
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
    select: { desiredHoursPerWeek: true },
  });

  if (!user) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    desiredHoursPerWeek: user.desiredHoursPerWeek,
  });
}

/**
 * PATCH /api/settings/desired-hours
 * Update current user's desired hours per week (for fairness analytics).
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Sign in required" },
        { status: 401 }
      );
    }

    let body: { desiredHoursPerWeek?: number | null | string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { code: "INVALID_JSON", message: "Invalid request body" },
        { status: 400 }
      );
    }

    let desiredHoursPerWeek: number | null | undefined | string = body.desiredHoursPerWeek;
    // Coerce empty string or NaN to null; parse numeric strings
    if (
      desiredHoursPerWeek === "" ||
      (typeof desiredHoursPerWeek === "number" && Number.isNaN(desiredHoursPerWeek))
    ) {
      desiredHoursPerWeek = null;
    } else if (typeof desiredHoursPerWeek === "string") {
      const parsed = parseFloat(desiredHoursPerWeek);
      desiredHoursPerWeek = Number.isNaN(parsed) ? null : parsed;
    }
    if (
      desiredHoursPerWeek != null &&
      (typeof desiredHoursPerWeek !== "number" ||
        desiredHoursPerWeek < 0 ||
        desiredHoursPerWeek > 80)
    ) {
      return NextResponse.json(
        {
          code: "INVALID_VALUE",
          message: "desiredHoursPerWeek must be between 0 and 80",
        },
        { status: 400 }
      );
    }

    const valueToSet =
      desiredHoursPerWeek === null || desiredHoursPerWeek === undefined
        ? null
        : Math.round(desiredHoursPerWeek * 100) / 100;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { desiredHoursPerWeek: valueToSet },
      select: { desiredHoursPerWeek: true },
    });

    return NextResponse.json({
      desiredHoursPerWeek: user.desiredHoursPerWeek,
    });
  } catch (err) {
    console.error("[PATCH /api/settings/desired-hours]", err);
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : "Failed to update desired hours";
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message },
      { status: 500 }
    );
  }
}
