/**
 * ShiftPolicyService - Pure validation functions for shift assignment.
 * All functions accept data as parameters (no DB calls) for testability.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ValidationSeverity = "warning" | "block";

export interface ValidationResult {
  type: ValidationSeverity;
  message: string;
  suggestions?: PolicyUser[];
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
  overtimeWarningHoursPerWeek: number;
  overtimeBlockHoursPerWeek: number;
}

const DEFAULT_CONFIG: ShiftPolicyConfig = {
  minRestHours: 11,
  overtimeWarningHoursPerWeek: 40,
  overtimeBlockHoursPerWeek: 48,
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
    type: "warning",
    message: `Less than ${minRestHours}h rest between shifts. May violate labor regulations.`,
  };
}

/**
 * Check if the user has all required skills for the shift.
 */
export function checkSkillMatch(
  shift: PolicyShift,
  userSkillIds: string[],
  allUsersWithSkills: Array<PolicyUser & { skillIds: string[] }>
): ValidationResult | null {
  const missing = shift.requiredSkillIds.filter((id) => !userSkillIds.includes(id));

  if (missing.length === 0) return null;

  const qualified = allUsersWithSkills.filter((u) =>
    shift.requiredSkillIds.every((sid) => u.skillIds.includes(sid))
  );

  return {
    type: "block",
    message: `User is missing ${missing.length} required skill(s) for this shift.`,
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

  return {
    type: "warning",
    message: "Shift falls outside user's declared availability.",
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
      message: `Assignment would exceed ${overtimeBlockHoursPerWeek}h/week (${totalHours.toFixed(1)}h).`,
      suggestions: alternativeUsers,
    };
  }

  if (totalHours >= overtimeWarningHoursPerWeek) {
    return {
      type: "warning",
      message: `Assignment would exceed ${overtimeWarningHoursPerWeek}h/week (${totalHours.toFixed(1)}h). Overtime may apply.`,
      suggestions: alternativeUsers,
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
  userSkillIds: string[];
  userCertifications: PolicyCertification[];
  userAvailabilityWindows: PolicyAvailabilityWindow[];
  userAssignments: PolicyAssignment[];
  userAssignmentsInWeek: PolicyAssignment[];
  allUsersWithSkills: Array<PolicyUser & { skillIds: string[] }>;
  allUsersWithLocationCerts: Array<PolicyUser & { hasValidCert: boolean }>;
  allUsersWithAvailability: Array<PolicyUser & { hasAvailability: boolean }>;
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
    userSkillIds,
    userCertifications,
    userAvailabilityWindows,
    userAssignments,
    userAssignmentsInWeek,
    allUsersWithSkills,
    allUsersWithLocationCerts,
    allUsersWithAvailability,
    excludeAssignmentId,
    config,
    now = new Date(),
  } = input;

  const blocks: ValidationResult[] = [];
  const warnings: ValidationResult[] = [];

  const doubleBook = checkDoubleBooking(
    shift,
    userAssignments,
    excludeAssignmentId
  );
  if (doubleBook) blocks.push(doubleBook);

  const restPeriod = checkRestPeriod(shift, userAssignments, config);
  if (restPeriod) warnings.push(restPeriod);

  const skillMatch = checkSkillMatch(
    shift,
    userSkillIds,
    allUsersWithSkills
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
  if (availability) warnings.push(availability);

  const overtime = checkOvertimeWarnings(
    shift,
    userAssignmentsInWeek,
    config,
    allUsersWithAvailability
      .filter((u) => u.hasAvailability)
      .map((u) => ({ id: u.id, name: u.name, email: u.email }))
  );
  if (overtime) {
    if (overtime.type === "block") blocks.push(overtime);
    else warnings.push(overtime);
  }

  return {
    valid: blocks.length === 0,
    blocks,
    warnings,
  };
}
