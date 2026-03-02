import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/availability/all
 * Returns all STAFF and MANAGER users with their availability windows.
 * Admin and Manager only.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Admin or manager access required" },
      { status: 403 }
    );
  }

  const staff = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["STAFF", "MANAGER"] },
    },
    include: {
      availabilityWindows: {
        include: {
          location: { select: { id: true, name: true, timezone: true } },
        },
        orderBy: [{ locationId: "asc" }, { dayOfWeek: "asc" }, { startsAt: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const staffWithWindows = staff.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    desiredHoursPerWeek: u.desiredHoursPerWeek,
    windows: u.availabilityWindows.map((w) => ({
      id: w.id,
      userId: w.userId,
      locationId: w.locationId,
      location: w.location,
      startsAt: w.startsAt.toISOString(),
      endsAt: w.endsAt.toISOString(),
      dayOfWeek: w.dayOfWeek,
      isRecurring: w.isRecurring,
    })),
  }));

  return NextResponse.json({ staff: staffWithWindows });
}
