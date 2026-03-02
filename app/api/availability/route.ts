import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";

/**
 * GET /api/availability?userId=...
 * List availability windows. Own windows by default; managers/admins can pass userId.
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
  const userIdParam = searchParams.get("userId");
  const role = (session.user as { role?: string }).role;
  const canManageOthers = role === "ADMIN" || role === "MANAGER";

  const userId = userIdParam && canManageOthers ? userIdParam : session.user.id;

  if (userIdParam && !canManageOthers && userIdParam !== session.user.id) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Cannot view other users' availability" },
      { status: 403 }
    );
  }

  const windows = await prisma.availabilityWindow.findMany({
    where: { userId },
    include: {
      location: { select: { id: true, name: true, timezone: true } },
    },
    orderBy: [{ locationId: "asc" }, { dayOfWeek: "asc" }, { startsAt: "asc" }],
  });

  return NextResponse.json({
    windows: windows.map((w) => ({
      id: w.id,
      userId: w.userId,
      locationId: w.locationId,
      location: w.location,
      startsAt: w.startsAt.toISOString(),
      endsAt: w.endsAt.toISOString(),
      dayOfWeek: w.dayOfWeek,
      isRecurring: w.isRecurring,
    })),
  });
}

/**
 * POST /api/availability
 * Create an availability window. User must be certified at the location.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  let body: {
    userId?: string;
    locationId: string;
    dayOfWeek?: number | null;
    startTime?: string;
    endTime?: string;
    isRecurring?: boolean;
    startsAt?: string;
    endsAt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const role = (session.user as { role?: string }).role;
  const canManageOthers = role === "ADMIN" || role === "MANAGER";
  const targetUserId = body.userId ?? session.user.id;
  if (targetUserId !== session.user.id && !canManageOthers) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Cannot create availability for others" },
      { status: 403 }
    );
  }

  const { locationId, isRecurring = true } = body;

  if (!locationId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "locationId is required" },
      { status: 400 }
    );
  }

  const [location, certification] = await Promise.all([
    prisma.location.findUnique({ where: { id: locationId } }),
    prisma.certification.findFirst({
      where: {
        userId: targetUserId,
        locationId,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);

  if (!location) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Location not found" },
      { status: 404 }
    );
  }

  if (!certification) {
    return NextResponse.json(
      { code: "CERTIFICATION_REQUIRED", message: "User must be certified at this location" },
      { status: 400 }
    );
  }

  const timezone = location.timezone;

  let startsAt: Date;
  let endsAt: Date;
  let dayOfWeek: number | null = null;

  if (isRecurring && body.dayOfWeek != null && body.startTime && body.endTime) {
    dayOfWeek = body.dayOfWeek;
    const [startH, startM] = body.startTime.split(":").map(Number);
    const [endH, endM] = body.endTime.split(":").map(Number);

    const refDate = new Date(2024, 0, 1, 0, 0, 0);
    const dayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    refDate.setDate(refDate.getDate() + dayOffset);
    const localStart = new Date(refDate);
    localStart.setHours(startH, startM, 0, 0);
    const localEnd = new Date(refDate);
    localEnd.setHours(endH > startH ? endH : endH + 24, endM, 0, 0);

    startsAt = fromZonedTime(localStart, timezone);
    endsAt = fromZonedTime(localEnd, timezone);
    if (endsAt <= startsAt) {
      endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
    }
  } else if (!isRecurring && body.startsAt && body.endsAt) {
    startsAt = new Date(body.startsAt);
    endsAt = new Date(body.endsAt);
  } else {
    return NextResponse.json(
      {
        code: "MISSING_FIELDS",
        message: isRecurring
          ? "dayOfWeek, startTime, endTime required for recurring"
          : "startsAt, endsAt required for one-off",
      },
      { status: 400 }
    );
  }

  if (endsAt <= startsAt && !isRecurring) {
    return NextResponse.json(
      { code: "INVALID_RANGE", message: "End time must be after start time" },
      { status: 400 }
    );
  }

  const window = await prisma.availabilityWindow.create({
    data: {
      userId: targetUserId,
      locationId,
      startsAt,
      endsAt,
      dayOfWeek,
      isRecurring,
    },
    include: {
      location: { select: { id: true, name: true, timezone: true } },
    },
  });

  return NextResponse.json({
    window: {
      id: window.id,
      userId: window.userId,
      locationId: window.locationId,
      location: window.location,
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
      dayOfWeek: window.dayOfWeek,
      isRecurring: window.isRecurring,
    },
  });
}
