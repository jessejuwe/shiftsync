import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";

/**
 * PATCH /api/availability/[id]
 * Update an availability window.
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
  const existing = await prisma.availabilityWindow.findUnique({
    where: { id },
    include: { location: true },
  });

  if (!existing) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Availability window not found" },
      { status: 404 }
    );
  }

  const role = (session.user as { role?: string }).role;
  const canManageOthers = role === "ADMIN" || role === "MANAGER";
  if (existing.userId !== session.user.id && !canManageOthers) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Cannot edit this availability" },
      { status: 403 }
    );
  }

  let body: {
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

  const updateData: {
    startsAt?: Date;
    endsAt?: Date;
    dayOfWeek?: number | null;
    isRecurring?: boolean;
  } = {};

  const isRecurring = body.isRecurring ?? existing.isRecurring;
  const timezone = existing.location.timezone;

  if (isRecurring && body.dayOfWeek != null && body.startTime && body.endTime) {
    const dayOfWeek = body.dayOfWeek;
    const [startH, startM] = body.startTime.split(":").map(Number);
    const [endH, endM] = body.endTime.split(":").map(Number);

    const refDate = new Date(2024, 0, 1, 0, 0, 0);
    const dayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    refDate.setDate(refDate.getDate() + dayOffset);
    const localStart = new Date(refDate);
    localStart.setHours(startH, startM, 0, 0);
    const localEnd = new Date(refDate);
    localEnd.setHours(endH > startH ? endH : endH + 24, endM, 0, 0);

    updateData.startsAt = fromZonedTime(localStart, timezone);
    updateData.endsAt = fromZonedTime(localEnd, timezone);
    if (updateData.endsAt <= updateData.startsAt) {
      updateData.endsAt = new Date(
        updateData.endsAt.getTime() + 24 * 60 * 60 * 1000
      );
    }
    updateData.dayOfWeek = dayOfWeek;
    updateData.isRecurring = true;
  } else if (!isRecurring && body.startsAt && body.endsAt) {
    updateData.startsAt = new Date(body.startsAt);
    updateData.endsAt = new Date(body.endsAt);
    updateData.dayOfWeek = null;
    updateData.isRecurring = false;
  } else if (Object.keys(body).length === 0) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "No fields to update" },
      { status: 400 }
    );
  }

  const window = await prisma.availabilityWindow.update({
    where: { id },
    data: updateData,
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

/**
 * DELETE /api/availability/[id]
 */
export async function DELETE(
  _request: NextRequest,
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
  const existing = await prisma.availabilityWindow.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Availability window not found" },
      { status: 404 }
    );
  }

  const role = (session.user as { role?: string }).role;
  const canManageOthers = role === "ADMIN" || role === "MANAGER";
  if (existing.userId !== session.user.id && !canManageOthers) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Cannot delete this availability" },
      { status: 403 }
    );
  }

  await prisma.availabilityWindow.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
