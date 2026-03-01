import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastSchedulePublished } from "@/lib/pusher-events";

/**
 * POST /api/shifts/publish
 * Publish schedule for a location and broadcast to real-time subscribers.
 */
export async function POST(request: NextRequest) {
  let body: { locationId: string; shiftIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { locationId, shiftIds } = body;
  if (!locationId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "locationId is required" },
      { status: 400 }
    );
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Location not found" },
      { status: 404 }
    );
  }

  await prisma.shift.updateMany({
    where: {
      locationId,
      ...(Array.isArray(shiftIds) ? { id: { in: shiftIds } } : {}),
    },
    data: { isPublished: true },
  });

  await broadcastSchedulePublished(locationId, {
    publishedAt: new Date().toISOString(),
    shiftIds,
  });

  return NextResponse.json(
    { success: true, message: "Schedule published" },
    { status: 200 }
  );
}
