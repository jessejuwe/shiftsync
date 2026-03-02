import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastClockInOut } from "@/lib/pusher-events";

/**
 * POST /api/shifts/assignments/[id]/clock-out
 * Staff clocks out of their shift. Only the assigned user can clock out.
 * Allowed when: clockedInAt is set and clockedOutAt is null.
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
      { code: "FORBIDDEN", message: "You can only clock out of your own shift" },
      { status: 403 }
    );
  }

  if (!assignment.clockedInAt) {
    return NextResponse.json(
      { code: "NOT_CLOCKED_IN", message: "You must clock in before clocking out" },
      { status: 400 }
    );
  }

  if (assignment.clockedOutAt) {
    return NextResponse.json(
      { code: "ALREADY_CLOCKED_OUT", message: "Already clocked out" },
      { status: 400 }
    );
  }

  const now = new Date();
  const updated = await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: { clockedOutAt: now },
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

  void broadcastClockInOut(assignment.shift.locationId, "clock-out", {
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
