/**
 * Fairness Analytics Engine
 * Pure calculation functions for shift distribution fairness.
 * Addresses "Fairness Complaint" scenarios: hours, premium shifts, equity.
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
  /** IANA timezone (e.g. America/New_York) for premium shift evaluation in location local time */
  timezone?: string;
}

export interface StaffFairnessInput {
  userId: string;
  assignments: AssignmentLike[];
}

export interface FairnessConfig {
  /** Friday = 5, Saturday = 6 (getUTCDay) */
  premiumDays: number[];
  /** Evening start hour (UTC), e.g. 17 = 5pm */
  premiumEveningStartHour: number;
  /** Target hours per period (e.g. 40/week) for desiredHoursDelta */
  targetHoursPerPeriod?: number;
}

export const DEFAULT_FAIRNESS_CONFIG: FairnessConfig = {
  premiumDays: [5, 6], // Fri, Sat
  premiumEveningStartHour: 17, // 5pm UTC
  targetHoursPerPeriod: 40,
};

// =============================================================================
// HELPERS
// =============================================================================

function hoursInRange(range: TimeRange): number {
  return (range.endsAt.getTime() - range.startsAt.getTime()) / (1000 * 60 * 60);
}

function getLocalDayAndHour(date: Date, timezone: string): { day: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sunday";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const dayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  return { day: dayMap[weekday] ?? 0, hour };
}

function isPremiumShift(
  range: TimeRange & { timezone?: string },
  config: Partial<FairnessConfig> = {}
): boolean {
  const { premiumDays, premiumEveningStartHour } = {
    ...DEFAULT_FAIRNESS_CONFIG,
    ...config,
  };

  let day: number;
  let hour: number;
  if (range.timezone) {
    const local = getLocalDayAndHour(range.startsAt, range.timezone);
    day = local.day;
    hour = local.hour;
  } else {
    day = range.startsAt.getUTCDay();
    hour = range.startsAt.getUTCHours();
  }

  return premiumDays.includes(day) && hour >= premiumEveningStartHour;
}

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

/**
 * Total hours per staff member for a set of assignments.
 * Returns Map<userId, totalHours>.
 */
export function totalHoursPerStaff(
  assignments: AssignmentLike[],
  config?: Partial<FairnessConfig>
): Map<string, number> {
  const map = new Map<string, number>();

  for (const a of assignments) {
    const hours = hoursInRange(a);
    const current = map.get(a.userId) ?? 0;
    map.set(a.userId, current + hours);
  }

  return map;
}

/**
 * Count of premium shifts (Fri/Sat evening) per staff member.
 * Returns Map<userId, count>.
 */
export function premiumShiftsPerStaff(
  assignments: AssignmentLike[],
  config: Partial<FairnessConfig> = {}
): Map<string, number> {
  const map = new Map<string, number>();

  for (const a of assignments) {
    if (isPremiumShift(a, config)) {
      const current = map.get(a.userId) ?? 0;
      map.set(a.userId, current + 1);
    }
  }

  return map;
}

/**
 * Delta between actual hours and desired/target hours.
 * Positive = over-scheduled, negative = under-scheduled.
 * desiredHours can be a Map<userId, number> or a single target for all.
 */
export function desiredHoursDelta(
  hoursPerStaff: Map<string, number>,
  desiredHours: number | Map<string, number> = DEFAULT_FAIRNESS_CONFIG.targetHoursPerPeriod ?? 40
): Map<string, number> {
  const result = new Map<string, number>();
  const useMap = typeof desiredHours === "object";

  for (const [userId, actual] of hoursPerStaff) {
    const target = useMap
      ? (desiredHours as Map<string, number>).get(userId) ?? 40
      : (desiredHours as number);
    result.set(userId, actual - target);
  }

  return result;
}

/**
 * Equity score 0–100 per staff.
 * Based on: hours fairness (closer to target = better) and premium distribution.
 * Higher = more fairly treated.
 */
export function equityScore(
  hoursPerStaff: Map<string, number>,
  premiumPerStaff: Map<string, number>,
  desiredHours: number | Map<string, number> = DEFAULT_FAIRNESS_CONFIG.targetHoursPerPeriod ?? 40,
  config?: Partial<FairnessConfig>
): Map<string, number> {
  const deltas = desiredHoursDelta(hoursPerStaff, desiredHours);
  const result = new Map<string, number>();

  const userIds = new Set([
    ...hoursPerStaff.keys(),
    ...premiumPerStaff.keys(),
  ]);

  if (userIds.size === 0) return result;

  const totalHours = [...hoursPerStaff.values()].reduce((a, b) => a + b, 0);
  const totalPremium = [...premiumPerStaff.values()].reduce((a, b) => a + b, 0);
  const avgHours = totalHours / userIds.size;
  const avgPremium = totalPremium / userIds.size;

  for (const userId of userIds) {
    const hours = hoursPerStaff.get(userId) ?? 0;
    const premium = premiumPerStaff.get(userId) ?? 0;
    const delta = deltas.get(userId) ?? 0;

    // Hours fairness: penalize large deviation from average
    const hoursDeviation = Math.abs(hours - avgHours);
    const maxHoursDev = Math.max(
      ...[...hoursPerStaff.values()].map((h) => Math.abs(h - avgHours)),
      1
    );
    const hoursScore = 100 * (1 - hoursDeviation / maxHoursDev);

    // Premium fairness: penalize deviation from average premium count
    const premiumDeviation =
      avgPremium > 0 ? Math.abs(premium - avgPremium) : 0;
    const maxPremiumDev =
      totalPremium > 0
        ? Math.max(
            ...[...premiumPerStaff.values()].map((p) =>
              Math.abs(p - avgPremium)
            ),
            0.01
          )
        : 0.01;
    const premiumScore =
      totalPremium > 0
        ? 100 * (1 - premiumDeviation / maxPremiumDev)
        : 100;

    // Combined: 60% hours, 40% premium
    const score = Math.round(0.6 * hoursScore + 0.4 * premiumScore);
    result.set(userId, Math.max(0, Math.min(100, score)));
  }

  return result;
}
