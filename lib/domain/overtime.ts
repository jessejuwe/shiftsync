/**
 * Overtime & What-If Engine
 * Pure calculation functions for hours, projections, and consecutive days.
 * Used for validation and what-if previews before confirming assignments.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TimeRange {
  startsAt: Date;
  endsAt: Date;
}

export interface AssignmentLike extends TimeRange {
  id: string;
  shiftId: string;
  userId: string;
}

export interface OvertimeConfig {
  overtimeWarningHoursPerWeek: number;
  overtimeBlockHoursPerWeek: number;
  maxDailyHours: number;
  maxConsecutiveDays: number;
}

export const DEFAULT_OVERTIME_CONFIG: OvertimeConfig = {
  overtimeWarningHoursPerWeek: 40,
  overtimeBlockHoursPerWeek: 48,
  maxDailyHours: 12,
  maxConsecutiveDays: 6,
};

// =============================================================================
// HELPERS
// =============================================================================

function hoursInRange(range: TimeRange): number {
  return (range.endsAt.getTime() - range.startsAt.getTime()) / (1000 * 60 * 60);
}

function toDateKey(d: Date): string {
  const date = new Date(d);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Hours a time range contributes to a specific calendar day (UTC). Splits overnight shifts. */
function hoursOnDate(range: TimeRange, dateKey: string): number {
  const dayStart = new Date(dateKey + "T00:00:00.000Z");
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const overlapStart =
    range.startsAt < dayStart ? dayStart : range.startsAt;
  const overlapEnd = range.endsAt > dayEnd ? dayEnd : range.endsAt;
  if (overlapStart >= overlapEnd) return 0;
  return (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate total hours for a set of assignments in a given week.
 * Week is determined by the reference date (shift start).
 */
export function calculateWeeklyHours(
  assignments: AssignmentLike[],
  weekReferenceDate: Date,
  excludeAssignmentId?: string
): number {
  const weekStart = getWeekStart(weekReferenceDate);
  const weekEnd = getWeekEnd(weekStart);

  return assignments
    .filter(
      (a) =>
        a.id !== excludeAssignmentId &&
        a.startsAt >= weekStart &&
        a.startsAt <= weekEnd
    )
    .reduce((sum, a) => sum + hoursInRange(a), 0);
}

/**
 * Calculate projected weekly hours if a proposed shift were added.
 * Returns { currentHours, shiftHours, projectedHours, overtimeHours }.
 */
export function calculateProjectedWeeklyHours(
  assignmentsInWeek: AssignmentLike[],
  proposedShift: TimeRange,
  config: Partial<OvertimeConfig> = {}
): {
  currentHours: number;
  shiftHours: number;
  projectedHours: number;
  overtimeHours: number;
  overtimeWarningHours: number;
  isOverWarning: boolean;
  isOverBlock: boolean;
} {
  const { overtimeWarningHoursPerWeek } = {
    ...DEFAULT_OVERTIME_CONFIG,
    ...config,
  };

  const currentHours = assignmentsInWeek.reduce(
    (sum, a) => sum + hoursInRange(a),
    0
  );
  const shiftHours = hoursInRange(proposedShift);
  const projectedHours = currentHours + shiftHours;
  const overtimeHours = Math.max(0, projectedHours - overtimeWarningHoursPerWeek);

  return {
    currentHours,
    shiftHours,
    projectedHours,
    overtimeHours,
    overtimeWarningHours: overtimeWarningHoursPerWeek,
    isOverWarning: projectedHours >= overtimeWarningHoursPerWeek,
    isOverBlock:
      projectedHours >=
      (config.overtimeBlockHoursPerWeek ??
        DEFAULT_OVERTIME_CONFIG.overtimeBlockHoursPerWeek),
  };
}

/**
 * Calculate total hours on a specific day for a user's assignments.
 * Splits overnight shifts across calendar days.
 */
export function calculateDailyHours(
  assignments: AssignmentLike[],
  date: Date,
  excludeAssignmentId?: string
): number {
  const dateKey = toDateKey(date);

  return assignments
    .filter((a) => a.id !== excludeAssignmentId)
    .filter(
      (a) =>
        toDateKey(a.startsAt) === dateKey || toDateKey(a.endsAt) === dateKey
    )
    .reduce((sum, a) => sum + hoursOnDate(a, dateKey), 0);
}

/**
 * Calculate projected daily hours if a proposed shift were added.
 * Splits overnight shifts across calendar days. Returns max across days the shift touches.
 */
export function calculateProjectedDailyHours(
  assignments: AssignmentLike[],
  proposedShift: TimeRange,
  excludeAssignmentId?: string
): { currentHours: number; shiftHours: number; projectedHours: number } {
  const startKey = toDateKey(proposedShift.startsAt);
  const endKey = toDateKey(proposedShift.endsAt);
  const dateKeys =
    startKey === endKey ? [startKey] : [startKey, endKey];

  let maxProjected = 0;
  let maxCurrent = 0;
  let maxShift = 0;

  for (const dateKey of dateKeys) {
    const currentHours = assignments
      .filter((a) => a.id !== excludeAssignmentId)
      .filter(
        (a) =>
          toDateKey(a.startsAt) === dateKey || toDateKey(a.endsAt) === dateKey
      )
      .reduce((sum, a) => sum + hoursOnDate(a, dateKey), 0);
    const shiftHours = hoursOnDate(proposedShift, dateKey);
    const projectedHours = currentHours + shiftHours;
    if (projectedHours > maxProjected) {
      maxProjected = projectedHours;
      maxCurrent = currentHours;
      maxShift = shiftHours;
    }
  }

  return {
    currentHours: maxCurrent,
    shiftHours: maxShift,
    projectedHours: maxProjected,
  };
}

/**
 * Calculate max consecutive working days from existing assignments only (no proposed shift).
 */
export function calculateConsecutiveDaysCurrent(
  assignments: AssignmentLike[],
  config: Partial<OvertimeConfig> = {}
): { maxConsecutive: number; is6thDay: boolean; is7thOrMore: boolean; limit: number } {
  const { maxConsecutiveDays } = { ...DEFAULT_OVERTIME_CONFIG, ...config };

  const dateKeys = new Set<string>();
  for (const a of assignments) {
    dateKeys.add(toDateKey(a.startsAt));
    if (toDateKey(a.endsAt) !== toDateKey(a.startsAt)) {
      dateKeys.add(toDateKey(a.endsAt));
    }
  }
  const sortedDates = Array.from(dateKeys).sort();

  let maxConsecutive = 0;
  let current = 0;
  let prevDate: string | null = null;

  for (const d of sortedDates) {
    if (prevDate === null) {
      current = 1;
    } else {
      const prevDays = Math.floor(
        new Date(prevDate + "T12:00:00.000Z").getTime() / 86400000
      );
      const currDays = Math.floor(
        new Date(d + "T12:00:00.000Z").getTime() / 86400000
      );
      const diffDays = currDays - prevDays;
      if (diffDays === 1) {
        current += 1;
      } else {
        current = 1;
      }
    }
    maxConsecutive = Math.max(maxConsecutive, current);
    prevDate = d;
  }

  return {
    maxConsecutive,
    is6thDay: maxConsecutive === 6,
    is7thOrMore: maxConsecutive >= 7,
    limit: maxConsecutiveDays,
  };
}

/**
 * Calculate max consecutive working days when including a proposed shift.
 * Returns the length of the longest streak of consecutive days with assignments.
 */
export function calculateConsecutiveDays(
  assignments: AssignmentLike[],
  proposedShift: TimeRange,
  excludeAssignmentId?: string,
  config: Partial<OvertimeConfig> = {}
): {
  maxConsecutive: number;
  exceedsLimit: boolean;
  limit: number;
} {
  const { maxConsecutiveDays } = { ...DEFAULT_OVERTIME_CONFIG, ...config };

  const allAssignments = [
    ...assignments.filter((a) => a.id !== excludeAssignmentId),
    {
      id: "proposed",
      shiftId: "",
      userId: "",
      startsAt: proposedShift.startsAt,
      endsAt: proposedShift.endsAt,
    } as AssignmentLike,
  ];

  const dateKeys = new Set<string>();
  for (const a of allAssignments) {
    dateKeys.add(toDateKey(a.startsAt));
    if (toDateKey(a.endsAt) !== toDateKey(a.startsAt)) {
      dateKeys.add(toDateKey(a.endsAt));
    }
  }
  const sortedDates = Array.from(dateKeys).sort();

  let maxConsecutive = 0;
  let current = 0;
  let prevDate: string | null = null;

  for (const d of sortedDates) {
    if (prevDate === null) {
      current = 1;
    } else {
      const prevDays = Math.floor(
        new Date(prevDate + "T12:00:00.000Z").getTime() / 86400000
      );
      const currDays = Math.floor(
        new Date(d + "T12:00:00.000Z").getTime() / 86400000
      );
      const diffDays = currDays - prevDays;
      if (diffDays === 1) {
        current += 1;
      } else {
        current = 1;
      }
    }
    maxConsecutive = Math.max(maxConsecutive, current);
    prevDate = d;
  }

  return {
    maxConsecutive,
    exceedsLimit: maxConsecutive > maxConsecutiveDays,
    limit: maxConsecutiveDays,
  };
}

/**
 * Generate a human-readable what-if preview message for an assignment.
 */
export function getWhatIfPreviewMessage(
  userName: string,
  projected: ReturnType<typeof calculateProjectedWeeklyHours>,
  config: Partial<OvertimeConfig> = {}
): string | null {
  if (!projected.isOverWarning) return null;

  const { overtimeWarningHoursPerWeek } = {
    ...DEFAULT_OVERTIME_CONFIG,
    ...config,
  };

  const overtime = projected.overtimeHours;
  const total = projected.projectedHours;

  return `This assignment will push ${userName} to ${total.toFixed(1)} hours${overtime > 0 ? ` (${overtime.toFixed(1)} overtime)` : ""}`;
}
