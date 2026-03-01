import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  totalHoursPerStaff,
  premiumShiftsPerStaff,
  desiredHoursDelta,
  equityScore,
  type AssignmentLike,
  DEFAULT_FAIRNESS_CONFIG,
} from "@/lib/domain/fairness";

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
 * GET /api/fairness/dashboard?locationId=...&weekStart=...
 * Returns fairness analytics: hours, premium shifts, equity.
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

  const allAssignments = await Promise.all(
    staff.map(async (s) => {
      const assignments = await prisma.shiftAssignment.findMany({
        where: {
          userId: s.id,
          ...(locationId && {
            shift: { locationId },
          }),
          shift: {
            startsAt: { gte: weekStart, lte: weekEnd },
          },
        },
        include: { shift: { select: { startsAt: true, endsAt: true } } },
      });
      return { userId: s.id, assignments, staff: s };
    })
  );

  const flatAssignments: AssignmentLike[] = [];
  for (const { userId, assignments } of allAssignments) {
    for (const a of assignments) {
      flatAssignments.push(toAssignmentLike(a));
    }
  }

  const targetHours = DEFAULT_FAIRNESS_CONFIG.targetHoursPerPeriod ?? 40;
  const hoursMap = totalHoursPerStaff(flatAssignments);
  const premiumMap = premiumShiftsPerStaff(flatAssignments);
  const deltaMap = desiredHoursDelta(hoursMap, targetHours);
  const equityMap = equityScore(hoursMap, premiumMap, targetHours);

  const staffFairness = allAssignments.map(({ userId, staff: s }) => {
    const hours = Math.round((hoursMap.get(userId) ?? 0) * 10) / 10;
    const premium = premiumMap.get(userId) ?? 0;
    const delta = Math.round((deltaMap.get(userId) ?? 0) * 10) / 10;
    const equity = equityMap.get(userId) ?? 50;

    return {
      userId: s.id,
      name: s.name,
      email: s.email,
      totalHours: hours,
      premiumShifts: premium,
      hoursDelta: delta,
      equityScore: equity,
      isOverScheduled: delta > 2,
      isUnderScheduled: delta < -2,
    };
  });

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    locationId: locationId ?? null,
    targetHours,
    staff: staffFairness.sort((a, b) => b.totalHours - a.totalHours),
  });
}
