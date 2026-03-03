import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateProjectedWeeklyHours,
  getWhatIfPreviewMessage,
  type AssignmentLike,
} from "@/lib/domain/overtime";

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function toPolicyAssignment(a: {
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
 * GET /api/shifts/assign/preview?shiftId=...&userId=...
 * Returns what-if preview for assigning a user to a shift.
 * Auth required. Staff can only preview themselves; managers/admins can preview any user.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const shiftId = searchParams.get("shiftId");
  const userId = searchParams.get("userId");

  if (!shiftId || !userId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "shiftId and userId are required" },
      { status: 400 }
    );
  }

  const role = (session.user as { role?: string }).role;
  const canManageOthers = role === "ADMIN" || role === "MANAGER";
  if (userId !== session.user.id && !canManageOthers) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You can only preview assignments for yourself" },
      { status: 403 }
    );
  }

  const [shift, user, userAssignments] = await Promise.all([
    prisma.shift.findUnique({
      where: { id: shiftId },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    }),
    prisma.shiftAssignment.findMany({
      where: { userId },
      include: { shift: { select: { startsAt: true, endsAt: true } } },
    }),
  ]);

  if (!shift || !user) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Shift or user not found" },
      { status: 404 }
    );
  }

  const weekStart = getWeekStart(shift.startsAt);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const assignmentsInWeek = userAssignments.filter((a) => {
    const s = a.shift.startsAt;
    return s >= weekStart && s <= weekEnd;
  });

  const policyAssignments = assignmentsInWeek.map(toPolicyAssignment);
  const proposedShift = {
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
  };

  const projected = calculateProjectedWeeklyHours(
    policyAssignments,
    proposedShift
  );
  const message = getWhatIfPreviewMessage(user.name, projected);

  return NextResponse.json({
    userName: user.name,
    currentHours: projected.currentHours,
    shiftHours: projected.shiftHours,
    projectedHours: projected.projectedHours,
    overtimeHours: projected.overtimeHours,
    overtimeWarningHours: projected.overtimeWarningHours,
    isOverWarning: projected.isOverWarning,
    isOverBlock: projected.isOverBlock,
    message,
  });
}
