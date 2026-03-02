import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastScheduleUnpublished } from "@/lib/pusher-events";
import { canUnpublishOrEdit } from "@/config/schedule";

/**
 * POST /api/shifts/unpublish
 * Unpublish schedule for a location. Admin/Manager only.
 * Rejects if any shift is within the cutoff (default 48h before shift start).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Admin or Manager access required" },
      { status: 403 }
    );
  }

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

  const where = {
    locationId,
    isPublished: true,
    ...(Array.isArray(shiftIds) ? { id: { in: shiftIds } } : {}),
  };

  const shifts = await prisma.shift.findMany({
    where,
    select: { id: true, startsAt: true },
  });

  const pastCutoff = shifts.filter((s) => !canUnpublishOrEdit(s.startsAt));
  if (pastCutoff.length > 0) {
    return NextResponse.json(
      {
        code: "CUTOFF_PASSED",
        message:
          "Cannot unpublish: one or more shifts are within the cutoff window (default 48 hours before start).",
        shiftIds: pastCutoff.map((s) => s.id),
      },
      { status: 400 }
    );
  }

  await prisma.shift.updateMany({
    where,
    data: { isPublished: false },
  });

  const updatedIds = shifts.map((s) => s.id);
  await broadcastScheduleUnpublished(locationId, {
    unpublishedAt: new Date().toISOString(),
    shiftIds: updatedIds,
  });

  return NextResponse.json(
    { success: true, message: "Schedule unpublished" },
    { status: 200 }
  );
}
