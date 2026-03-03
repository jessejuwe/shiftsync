import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastClockInOut } from "@/lib/pusher-events";

/** Allow clock-in up to 15 minutes before shift start */
const CLOCK_IN_EARLY_MINUTES = 15;

/**
 * POST /api/shifts/assignments/[id]/clock-in
 * Staff clocks in to their assigned shift. Only the assigned user can clock in.
 * Allowed when: now is within [shiftStart - 15min, shiftEnd], assignment is theirs, clockedInAt is null.
 */
export async function POST(
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

  const { id: assignmentId } = await params;

  const assignment = await prisma.shiftAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      shift: {
        select: {
          id: true,
          locationId: true,
          startsAt: true,
          endsAt: true,
          isPublished: true,
        },
      },
    },
  });

  if (!assignment) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Assignment not found" },
      { status: 404 }
    );
  }

  if (assignment.userId !== session.user.id) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You can only clock in to your own shift" },
      { status: 403 }
    );
  }

  if (assignment.clockedInAt) {
    return NextResponse.json(
      { code: "ALREADY_CLOCKED_IN", message: "Already clocked in" },
      { status: 400 }
    );
  }

  if (assignment.clockedOutAt) {
    return NextResponse.json(
      { code: "ALREADY_CLOCKED_OUT", message: "Already clocked out" },
      { status: 400 }
    );
  }

  if (!assignment.shift.isPublished) {
    return NextResponse.json(
      { code: "SHIFT_NOT_PUBLISHED", message: "Shift is not published" },
      { status: 400 }
    );
  }

  const now = new Date();
  const windowStart = new Date(assignment.shift.startsAt);
  windowStart.setMinutes(windowStart.getMinutes() - CLOCK_IN_EARLY_MINUTES);
  const windowEnd = assignment.shift.endsAt;

  if (now < windowStart) {
    return NextResponse.json(
      {
        code: "TOO_EARLY",
        message: `You can clock in up to ${CLOCK_IN_EARLY_MINUTES} minutes before your shift`,
      },
      { status: 400 }
    );
  }

  if (now > windowEnd) {
    return NextResponse.json(
      { code: "SHIFT_ENDED", message: "Shift has already ended" },
      { status: 400 }
    );
  }

  const updated = await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: { clockedInAt: now },
    include: {
      user: { select: { id: true, name: true, email: true } },
      shift: {
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          location: { select: { id: true, name: true, timezone: true } },
        },
      },
    },
  });

  void broadcastClockInOut(assignment.shift.locationId, "clock-in", {
    assignmentId,
    shiftId: assignment.shift.id,
    userId: updated.userId,
    locationId: assignment.shift.locationId,
    clockedAt: now.toISOString(),
  });

  return NextResponse.json({
    assignment: {
      id: updated.id,
      clockedInAt: updated.clockedInAt?.toISOString(),
      clockedOutAt: updated.clockedOutAt?.toISOString(),
    },
  });
}
