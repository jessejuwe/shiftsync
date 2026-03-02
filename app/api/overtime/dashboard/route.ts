import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculatePeriodHours,
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
  const weekCount = Math.min(4, Math.max(1, parseInt(searchParams.get("weekCount") ?? "1", 10) || 1));

  const now = new Date();
  const weekStart = weekStartParam
    ? getWeekStart(new Date(weekStartParam))
    : getWeekStart(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + weekCount * 7 - 1);
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
        include: {
          shift: {
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              title: true,
            },
          },
        },
      });
      return { userId: s.id, assignments, staff: s };
    })
  );

  const location = locationId
    ? await prisma.location.findUnique({
        where: { id: locationId },
        select: { hourlyRate: true },
      })
    : null;
  const hourlyRate = location?.hourlyRate ?? 25; // Default $25/hr for cost projection
  const OVERTIME_MULTIPLIER = 1.5;

  const { overtimeWarningHoursPerWeek } = DEFAULT_OVERTIME_CONFIG;
  const periodOvertimeThreshold = overtimeWarningHoursPerWeek * weekCount;
  const APPROACHING_HOURS = 35 * weekCount;

  const staffHours = allStaffAssignments.map(({ userId, assignments, staff: s }) => {
    const policyAssignments = assignments.map(toAssignmentLike);
    const hoursThisWeek = calculatePeriodHours(
      policyAssignments,
      weekStart,
      weekEnd
    );
    const consecutive = calculateConsecutiveDaysCurrent(policyAssignments);

    const assignmentsInPeriod = assignments.filter(
      (a) =>
        a.shift.startsAt >= weekStart &&
        a.shift.startsAt <= weekEnd
    );
    const overtimeHours = Math.max(0, hoursThisWeek - periodOvertimeThreshold);
    const overtimeCost = Math.round(overtimeHours * hourlyRate * OVERTIME_MULTIPLIER * 100) / 100;

    return {
      userId: s.id,
      name: s.name,
      email: s.email,
      hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
      approachingOvertime: hoursThisWeek >= APPROACHING_HOURS,
      overOvertime: hoursThisWeek >= periodOvertimeThreshold,
      consecutiveDays: consecutive.maxConsecutive,
      is6thConsecutiveDay: consecutive.is6thDay,
      is7thOrMoreConsecutiveDay: consecutive.is7thOrMore,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      overtimeCost,
      assignments: assignmentsInPeriod.map((a) => ({
        id: a.id,
        shiftId: a.shift.id,
        startsAt: a.shift.startsAt.toISOString(),
        endsAt: a.shift.endsAt.toISOString(),
        title: a.shift.title,
        hours: Math.round(
          ((a.shift.endsAt.getTime() - a.shift.startsAt.getTime()) / (1000 * 60 * 60)) * 10
        ) / 10,
      })),
    };
  });

  const totalProjectedOvertimeCost = staffHours.reduce(
    (sum, s) => sum + (s.overtimeCost ?? 0),
    0
  );

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    locationId: locationId ?? null,
    weekCount,
    hourlyRate,
    totalProjectedOvertimeCost,
    staff: staffHours.sort((a, b) => b.hoursThisWeek - a.hoursThisWeek),
  });
}
