/**
 * ShiftPolicyService - Pure validation functions for shift assignment.
 * All functions accept data as parameters (no DB calls) for testability.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ValidationSeverity = "warning" | "block";

export type ValidationCode =
  | "DOUBLE_BOOKING"
  | "REST_VIOLATION"
  | "SKILL_MISMATCH"
  | "CERTIFICATION_REQUIRED"
  | "AVAILABILITY_VIOLATION"
  | "NO_AVAILABILITY_SET"
  | "DAILY_HOURS_EXCEEDED"
  | "DAILY_HOURS_WARNING"
  | "WEEKLY_HOURS_EXCEEDED"
  | "CONSECUTIVE_DAYS_EXCEEDED";

export interface ValidationResult {
  type: ValidationSeverity;
  code: ValidationCode;
  message: string;
  suggestions?: PolicyUser[];
  metadata?: { maxConsecutive?: number; is6thDay?: boolean; requiresOverride?: boolean };
}

export interface PolicyUser {
  id: string;
  name: string;
  email: string;
}

export interface TimeRange {
  startsAt: Date;
  endsAt: Date;
}

export interface PolicyShift extends TimeRange {
  id: string;
  locationId: string;
  requiredSkillIds: string[];
  /** Optional skill names for user-facing messages (e.g. "missing kitchen skill") */
  requiredSkillNames?: Array<{ id: string; name: string }>;
}

export interface PolicyAssignment extends TimeRange {
  id: string;
  shiftId: string;
  userId: string;
}

export interface PolicyStaffSkill {
  userId: string;
  skillId: string;
}

export interface PolicyCertification {
  userId: string;
  locationId: string;
  expiresAt: Date;
}

export interface PolicyAvailabilityWindow extends TimeRange {
  userId: string;
  locationId: string;
  dayOfWeek: number | null; // 0-6, null for one-off
  isRecurring: boolean;
}

export interface ShiftPolicyConfig {
  minRestHours: number;
  maxDailyHoursWarning: number; // 8h = warning
  maxDailyHours: number; // 12h = hard block
  overtimeWarningHoursPerWeek: number;
  overtimeBlockHoursPerWeek: number;
  maxConsecutiveDays: number;
}

const DEFAULT_CONFIG: ShiftPolicyConfig = {
  minRestHours: 10,
  maxDailyHoursWarning: 8,
  maxDailyHours: 12,
  overtimeWarningHoursPerWeek: 40,
  overtimeBlockHoursPerWeek: 48,
  maxConsecutiveDays: 6,
};

// =============================================================================
// HELPERS
// =============================================================================

function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

function hoursBetween(end: Date, start: Date): number {
  return (start.getTime() - end.getTime()) / (1000 * 60 * 60);
}

function hoursInRange(range: TimeRange): number {
  return (range.endsAt.getTime() - range.startsAt.getTime()) / (1000 * 60 * 60);
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Check if assigning the user would create a double booking (overlapping shift).
 */
export function checkDoubleBooking(
  shift: PolicyShift,
  userAssignments: PolicyAssignment[],
  excludeAssignmentId?: string
): ValidationResult | null {
  const conflicting = userAssignments.filter(
    (a) =>
      a.id !== excludeAssignmentId &&
      rangesOverlap(
        { startsAt: shift.startsAt, endsAt: shift.endsAt },
        { startsAt: a.startsAt, endsAt: a.endsAt }
      )
  );

  if (conflicting.length === 0) return null;

  return {
    type: "block",
    code: "DOUBLE_BOOKING",
    message: `User is already assigned to ${conflicting.length} overlapping shift(s).`,
  };
}

/**
 * Check if there is sufficient rest period between the new shift and existing assignments.
 */
export function checkRestPeriod(
  shift: PolicyShift,
  userAssignments: PolicyAssignment[],
  config: Partial<ShiftPolicyConfig> = {}
): ValidationResult | null {
  const { minRestHours } = { ...DEFAULT_CONFIG, ...config };

  const violations = userAssignments.filter((a) => {
    const restBefore = hoursBetween(a.endsAt, shift.startsAt);
    const restAfter = hoursBetween(shift.endsAt, a.startsAt);
    return (
      (restBefore > 0 && restBefore < minRestHours) ||
      (restAfter > 0 && restAfter < minRestHours)
    );
  });

  if (violations.length === 0) return null;

  return {
    type: "block",
    code: "REST_VIOLATION",
    message: `Less than ${minRestHours}h rest between shifts. Labor regulations require at least ${minRestHours}h rest.`,
  };
}

function formatMissingSkillsMessage(
  missingNames: string[],
  userName: string = "User"
): string {
  if (missingNames.length === 0)
    return `${userName} is missing required skills for this shift.`;
  if (missingNames.length === 1)
    return `${userName} is missing ${missingNames[0]} skill for this shift.`;
  if (missingNames.length === 2)
    return `${userName} is missing ${missingNames[0]} and ${missingNames[1]} skills for this shift.`;
  const rest = missingNames.slice(0, -1).join(", ");
  const last = missingNames[missingNames.length - 1];
  return `${userName} is missing ${rest}, and ${last} skills for this shift.`;
}

/**
 * Check if the user has all required skills for the shift.
 */
export function checkSkillMatch(
  shift: PolicyShift,
  userSkillIds: string[],
  allUsersWithSkills: Array<PolicyUser & { skillIds: string[] }>,
  userName?: string
): ValidationResult | null {
  const missingIds = shift.requiredSkillIds.filter(
    (id) => !userSkillIds.includes(id)
  );

  if (missingIds.length === 0) return null;

  const missingNames = shift.requiredSkillNames
    ?.filter((s) => missingIds.includes(s.id))
    .map((s) => s.name);

  const qualified = allUsersWithSkills.filter((u) =>
    shift.requiredSkillIds.every((sid) => u.skillIds.includes(sid))
  );

  const displayName = userName ?? "User";
  const message =
    missingNames && missingNames.length === missingIds.length
      ? formatMissingSkillsMessage(missingNames, displayName)
      : `${displayName} is missing ${missingIds.length} required skill(s) for this shift.`;

  return {
    type: "block",
    code: "SKILL_MISMATCH",
    message,
    suggestions: qualified.map((u) => ({ id: u.id, name: u.name, email: u.email })),
  };
}

/**
 * Check if the user has valid (non-expired) certifications for the shift's location.
 */
export function checkLocationCertification(
  shift: PolicyShift,
  userCertifications: PolicyCertification[],
  now: Date,
  allUsersWithCerts: Array<PolicyUser & { hasValidCert: boolean }>
): ValidationResult | null {
  const validForLocation = userCertifications.filter(
    (c) =>
      c.locationId === shift.locationId && new Date(c.expiresAt) > now
  );

  if (validForLocation.length > 0) return null;

  const qualified = allUsersWithCerts.filter((u) => u.hasValidCert);

  return {
    type: "block",
    code: "CERTIFICATION_REQUIRED",
    message: "User has no valid certification for this location.",
    suggestions: qualified.map((u) => ({ id: u.id, name: u.name, email: u.email })),
  };
}

/**
 * Check if the shift falls within the user's availability windows.
 * For recurring windows: projects window to shift's date using time-of-day.
 */
export function checkAvailability(
  shift: PolicyShift,
  userWindows: PolicyAvailabilityWindow[],
  allUsersWithAvailability: Array<PolicyUser & { hasAvailability: boolean }>
): ValidationResult | null {
  const shiftStart = shift.startsAt;
  const shiftEnd = shift.endsAt;
  const shiftStartDay = shiftStart.getUTCDay();

  const matches = userWindows.filter((w) => {
    if (w.locationId !== shift.locationId) return false;

    let windowStart: Date;
    let windowEnd: Date;

    if (w.isRecurring && w.dayOfWeek !== null) {
      if (w.dayOfWeek !== shiftStartDay) return false;
      // Project recurring window to shift's date (use time-of-day only)
      const base = new Date(shiftStart);
      base.setUTCHours(0, 0, 0, 0);
      const startMs =
        w.startsAt.getUTCHours() * 3600000 +
        w.startsAt.getUTCMinutes() * 60000 +
        w.startsAt.getUTCSeconds() * 1000;
      const endMs =
        w.endsAt.getUTCHours() * 3600000 +
        w.endsAt.getUTCMinutes() * 60000 +
        w.endsAt.getUTCSeconds() * 1000;
      windowStart = new Date(base.getTime() + startMs);
      windowEnd = new Date(base.getTime() + endMs);
      // Handle overnight recurring (e.g. 22:00-06:00)
      if (windowEnd <= windowStart) windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
    } else {
      windowStart = w.startsAt;
      windowEnd = w.endsAt;
    }

    return rangesOverlap(
      { startsAt: shiftStart, endsAt: shiftEnd },
      { startsAt: windowStart, endsAt: windowEnd }
    );
  });

  if (matches.length > 0) return null;

  const qualified = allUsersWithAvailability.filter((u) => u.hasAvailability);

  const hasNoAvailability = userWindows.length === 0;

  return {
    type: "block",
    code: hasNoAvailability ? "NO_AVAILABILITY_SET" : "AVAILABILITY_VIOLATION",
    message: hasNoAvailability
      ? "User has not set availability for this location. Set availability before picking up shifts."
      : "Shift falls outside user's declared availability.",
    suggestions: qualified.map((u) => ({ id: u.id, name: u.name, email: u.email })),
  };
}

/**
 * Check if assigning would push the user into overtime (warning or block).
 */
export function checkOvertimeWarnings(
  shift: PolicyShift,
  userAssignmentsInWeek: PolicyAssignment[],
  config: Partial<ShiftPolicyConfig> = {},
  alternativeUsers?: PolicyUser[]
): ValidationResult | null {
  const {
    overtimeWarningHoursPerWeek,
    overtimeBlockHoursPerWeek,
  } = { ...DEFAULT_CONFIG, ...config };

  const existingHours = userAssignmentsInWeek.reduce(
    (sum, a) => sum + hoursInRange({ startsAt: a.startsAt, endsAt: a.endsAt }),
    0
  );
  const shiftHours = hoursInRange({ startsAt: shift.startsAt, endsAt: shift.endsAt });
  const totalHours = existingHours + shiftHours;

  if (totalHours >= overtimeBlockHoursPerWeek) {
    return {
      type: "block",
      code: "WEEKLY_HOURS_EXCEEDED",
      message: `Assignment would exceed ${overtimeBlockHoursPerWeek}h/week (${totalHours.toFixed(1)}h).`,
      suggestions: alternativeUsers,
    };
  }

  if (totalHours >= overtimeWarningHoursPerWeek) {
    return {
      type: "warning",
      code: "WEEKLY_HOURS_EXCEEDED",
      message: `Assignment would exceed ${overtimeWarningHoursPerWeek}h/week (${totalHours.toFixed(1)}h). Overtime may apply.`,
      suggestions: alternativeUsers,
    };
  }

  return null;
}

// =============================================================================
// ADDITIONAL VALIDATION FUNCTIONS
// =============================================================================

function toDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
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

/**
 * Check if assigning would exceed max hours in a single day.
 * Warning at 8h, hard block at 12h. Splits overnight shifts across calendar days.
 */
export function checkDailyHoursLimit(
  shift: PolicyShift,
  userAssignments: PolicyAssignment[],
  config: Partial<ShiftPolicyConfig> = {},
  excludeAssignmentId?: string,
  alternativeUsers?: PolicyUser[]
): ValidationResult | null {
  const { maxDailyHoursWarning, maxDailyHours } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const startKey = toDateKey(shift.startsAt);
  const endKey = toDateKey(shift.endsAt);
  const dateKeys = startKey === endKey ? [startKey] : [startKey, endKey];

  for (const dateKey of dateKeys) {
    const existingHours = userAssignments
      .filter((a) => a.id !== excludeAssignmentId)
      .filter(
        (a) =>
          toDateKey(a.startsAt) === dateKey || toDateKey(a.endsAt) === dateKey
      )
      .reduce(
        (sum, a) =>
          sum + hoursOnDate({ startsAt: a.startsAt, endsAt: a.endsAt }, dateKey),
        0
      );
    const shiftHoursOnDay = hoursOnDate(
      { startsAt: shift.startsAt, endsAt: shift.endsAt },
      dateKey
    );
    const totalDailyHours = existingHours + shiftHoursOnDay;

    if (totalDailyHours > maxDailyHours) {
      return {
        type: "block",
        code: "DAILY_HOURS_EXCEEDED",
        message: `Assignment would exceed ${maxDailyHours}h/day limit (${totalDailyHours.toFixed(1)}h on ${dateKey}).`,
        suggestions: alternativeUsers,
      };
    }
    if (totalDailyHours > maxDailyHoursWarning) {
      return {
        type: "warning",
        code: "DAILY_HOURS_WARNING",
        message: `Assignment would exceed ${maxDailyHoursWarning}h/day warning (${totalDailyHours.toFixed(1)}h on ${dateKey}).`,
        suggestions: alternativeUsers,
      };
    }
  }

  return null;
}

/**
 * Check weekly hours projection (warning at 40h, block at 48h).
 * Alias for checkOvertimeWarnings with consistent naming.
 */
export function checkWeeklyHoursProjection(
  shift: PolicyShift,
  userAssignmentsInWeek: PolicyAssignment[],
  config: Partial<ShiftPolicyConfig> = {},
  alternativeUsers?: PolicyUser[]
): ValidationResult | null {
  return checkOvertimeWarnings(
    shift,
    userAssignmentsInWeek,
    config,
    alternativeUsers
  );
}

/**
 * Check if assigning would exceed max consecutive working days.
 */
export function checkConsecutiveDays(
  shift: PolicyShift,
  userAssignments: PolicyAssignment[],
  config: Partial<ShiftPolicyConfig> = {},
  excludeAssignmentId?: string,
  alternativeUsers?: PolicyUser[]
): ValidationResult | null {
  const { maxConsecutiveDays } = { ...DEFAULT_CONFIG, ...config };

  const allAssignments = [
    ...userAssignments.filter((a) => a.id !== excludeAssignmentId),
    {
      id: "proposed",
      shiftId: shift.id,
      userId: "",
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    } as PolicyAssignment,
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

  if (maxConsecutive > maxConsecutiveDays) {
    return {
      type: "block",
      code: "CONSECUTIVE_DAYS_EXCEEDED",
      message:
        maxConsecutive === 7
          ? `Assignment would be 7th consecutive day. Override with reason required.`
          : `Assignment would exceed ${maxConsecutiveDays} consecutive working days (${maxConsecutive} days).`,
      suggestions: alternativeUsers,
      metadata: { maxConsecutive, requiresOverride: maxConsecutive === 7 },
    };
  }

  if (maxConsecutive === maxConsecutiveDays) {
    return {
      type: "warning",
      code: "CONSECUTIVE_DAYS_EXCEEDED",
      message: `Assignment would be 6th consecutive working day.`,
      suggestions: alternativeUsers,
      metadata: { maxConsecutive, is6thDay: true },
    };
  }

  return null;
}

// =============================================================================
// COMPOSED VALIDATION
// =============================================================================

export interface ValidateShiftAssignmentInput {
  shift: PolicyShift;
  userId: string;
  /** User's display name for validation messages (e.g. "John is missing Kitchen skill") */
  userName?: string;
  userSkillIds: string[];
  userCertifications: PolicyCertification[];
  userAvailabilityWindows: PolicyAvailabilityWindow[];
  userAssignments: PolicyAssignment[];
  userAssignmentsInWeek: PolicyAssignment[];
  allUsersWithSkills: Array<PolicyUser & { skillIds: string[] }>;
  allUsersWithLocationCerts: Array<PolicyUser & { hasValidCert: boolean }>;
  allUsersWithAvailability: Array<PolicyUser & { hasAvailability: boolean }>;
  /** When provided, used for overtime/daily/consecutive suggestions instead of allUsersWithAvailability */
  qualifiedAlternatives?: PolicyUser[];
  excludeAssignmentId?: string;
  config?: Partial<ShiftPolicyConfig>;
  now?: Date;
}

export interface ValidateShiftAssignmentOutput {
  valid: boolean;
  blocks: ValidationResult[];
  warnings: ValidationResult[];
}

/**
 * Composes all validation rules. Returns blocks (must fix) and warnings (can override).
 */
export function validateShiftAssignment(
  input: ValidateShiftAssignmentInput
): ValidateShiftAssignmentOutput {
  const {
    shift,
    userName,
    userSkillIds,
    userCertifications,
    userAvailabilityWindows,
    userAssignments,
    userAssignmentsInWeek,
    allUsersWithSkills,
    allUsersWithLocationCerts,
    allUsersWithAvailability,
    qualifiedAlternatives,
    excludeAssignmentId,
    config,
    now = new Date(),
  } = input;

  const blocks: ValidationResult[] = [];
  const warnings: ValidationResult[] = [];

  const alternativeUsers =
    qualifiedAlternatives ??
    allUsersWithAvailability
      .filter((u) => u.hasAvailability)
      .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  const doubleBook = checkDoubleBooking(
    shift,
    userAssignments,
    excludeAssignmentId
  );
  if (doubleBook) blocks.push(doubleBook);

  const restPeriod = checkRestPeriod(shift, userAssignments, config);
  if (restPeriod) blocks.push(restPeriod);

  const skillMatch = checkSkillMatch(
    shift,
    userSkillIds,
    allUsersWithSkills,
    userName
  );
  if (skillMatch) blocks.push(skillMatch);

  const locationCert = checkLocationCertification(
    shift,
    userCertifications,
    now,
    allUsersWithLocationCerts
  );
  if (locationCert) blocks.push(locationCert);

  const availability = checkAvailability(
    shift,
    userAvailabilityWindows,
    allUsersWithAvailability
  );
  if (availability) blocks.push(availability);

  const dailyHours = checkDailyHoursLimit(
    shift,
    userAssignments,
    config,
    excludeAssignmentId,
    alternativeUsers
  );
  if (dailyHours) {
    if (dailyHours.type === "block") blocks.push(dailyHours);
    else warnings.push(dailyHours);
  }

  const weeklyHours = checkWeeklyHoursProjection(
    shift,
    userAssignmentsInWeek,
    config,
    alternativeUsers
  );
  if (weeklyHours) {
    if (weeklyHours.type === "block") blocks.push(weeklyHours);
    else warnings.push(weeklyHours);
  }

  const consecutiveDays = checkConsecutiveDays(
    shift,
    userAssignments,
    config,
    excludeAssignmentId,
    alternativeUsers
  );
  if (consecutiveDays) {
    if (consecutiveDays.type === "block") blocks.push(consecutiveDays);
    else warnings.push(consecutiveDays);
  }

  return {
    valid: blocks.length === 0,
    blocks,
    warnings,
  };
}
