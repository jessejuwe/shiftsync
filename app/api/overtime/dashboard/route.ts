import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateWeeklyHours,
  calculateConsecutiveDaysCurrent,
  type AssignmentLike,
  DEFAULT_OVERTIME_CONFIG,
} from "@/lib/domain/overtime";

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function toAssignmentLike(a: {
  id: string;
  shiftId: string;
  userId: string;
  shift: { startsAt: Date; endsAt: Date };
}): AssignmentLike {
  return {
    id: a.id,
    shiftId: a.shiftId,
    userId: a.userId,
    startsAt: a.shift.startsAt,
    endsAt: a.shift.endsAt,
  };
}

/**
 * GET /api/overtime/dashboard?locationId=...&weekStart=...
 * Returns staff hours for the week with overtime/consecutive-day highlights.
 * Manager dashboard data.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const weekStartParam = searchParams.get("weekStart");

  const now = new Date();
  const weekStart = weekStartParam
    ? getWeekStart(new Date(weekStartParam))
    : getWeekStart(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const staff = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["STAFF", "MANAGER"] },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const consecutiveCutoff = new Date(weekStart);
  consecutiveCutoff.setUTCDate(consecutiveCutoff.getUTCDate() - 14);

  const allStaffAssignments = await Promise.all(
    staff.map(async (s) => {
      const assignments = await prisma.shiftAssignment.findMany({
        where: {
          userId: s.id,
          shift: {
            ...(locationId && { locationId }),
            endsAt: { gte: consecutiveCutoff },
          },
        },
        include: { shift: { select: { startsAt: true, endsAt: true } } },
      });
      return { userId: s.id, assignments, staff: s };
    })
  );

  const APPROACHING_HOURS = 35;
  const { overtimeWarningHoursPerWeek } = DEFAULT_OVERTIME_CONFIG;

  const staffHours = allStaffAssignments.map(({ userId, assignments, staff: s }) => {
    const policyAssignments = assignments.map(toAssignmentLike);
    const hoursThisWeek = calculateWeeklyHours(
      policyAssignments,
      weekStart
    );
    const consecutive = calculateConsecutiveDaysCurrent(policyAssignments);

    return {
      userId: s.id,
      name: s.name,
      email: s.email,
      hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
      approachingOvertime: hoursThisWeek >= APPROACHING_HOURS,
      overOvertime: hoursThisWeek >= overtimeWarningHoursPerWeek,
      consecutiveDays: consecutive.maxConsecutive,
      is6thConsecutiveDay: consecutive.is6thDay,
      is7thOrMoreConsecutiveDay: consecutive.is7thOrMore,
    };
  });

  const filtered = staffHours;

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    locationId: locationId ?? null,
    staff: filtered.sort((a, b) => b.hoursThisWeek - a.hoursThisWeek),
  });
}
