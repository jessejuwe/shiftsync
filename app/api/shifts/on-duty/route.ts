import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/shifts/on-duty?locationId=...
 * Returns staff currently on shift who have clocked in (clockedInAt set, clockedOutAt null).
 * Shift must be active (now between startsAt and endsAt). Grouped by location.
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
  const locationId = searchParams.get("locationId");
  const now = new Date();

  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      NOT: { clockedInAt: null },
      clockedOutAt: null,
      shift: {
        startsAt: { lte: now },
        endsAt: { gte: now },
        isPublished: true,
        ...(locationId ? { locationId } : {}),
      },
    },
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
    orderBy: [{ shift: { locationId: "asc" } }, { user: { name: "asc" } }],
  });

  // Group by location
  const byLocation: Record<
    string,
    {
      location: { id: string; name: string; timezone: string };
      staff: {
        id: string;
        userId: string;
        userName: string;
        userEmail: string;
        shiftStartsAt: string;
        shiftEndsAt: string;
      }[];
    }
  > = {};

  for (const a of assignments) {
    const loc = a.shift.location;
    const key = loc.id;
    if (!byLocation[key]) {
      byLocation[key] = {
        location: loc,
        staff: [],
      };
    }
    byLocation[key].staff.push({
      id: a.id,
      userId: a.userId,
      userName: a.user.name,
      userEmail: a.user.email,
      shiftStartsAt: a.shift.startsAt.toISOString(),
      shiftEndsAt: a.shift.endsAt.toISOString(),
    });
  }

  const locations = Object.values(byLocation);

  return NextResponse.json({
    locations,
    fetchedAt: now.toISOString(),
  });
}
