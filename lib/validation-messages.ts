import type { ValidationCode } from "@/lib/domain/shift-policy";

export const VALIDATION_LABELS: Record<ValidationCode, string> = {
  DOUBLE_BOOKING: "Double booking",
  REST_VIOLATION: "Rest period (<10h)",
  SKILL_MISMATCH: "Missing skills",
  CERTIFICATION_REQUIRED: "Location certification",
  AVAILABILITY_VIOLATION: "Outside availability",
  DAILY_HOURS_EXCEEDED: "Daily hours exceeded (>12h)",
  DAILY_HOURS_WARNING: "Daily hours warning (>8h)",
  WEEKLY_HOURS_EXCEEDED: "Weekly hours (overtime)",
  CONSECUTIVE_DAYS_EXCEEDED: "Too many consecutive days",
};

/** Staff-friendly messages when picking up a shift (shown in pick-up modal) */
export const STAFF_PICKUP_MESSAGES: Record<ValidationCode, string> = {
  DOUBLE_BOOKING:
    "You already have a shift at that time. Check your schedule and try a different shift.",
  REST_VIOLATION:
    "You need at least 10 hours rest between shifts. This shift is too close to another one.",
  SKILL_MISMATCH:
    "This shift requires skills you don't have yet. Contact your manager if you think this is a mistake.",
  CERTIFICATION_REQUIRED:
    "You're not certified for this location yet. Contact your manager to get certified.",
  AVAILABILITY_VIOLATION:
    "This shift is outside your availability. Update your availability in Settings if your schedule has changed.",
  DAILY_HOURS_EXCEEDED:
    "This would put you over 12 hours in a single day. Pick a different shift.",
  DAILY_HOURS_WARNING:
    "This would put you over 8 hours in a single day. Consider taking a shorter shift.",
  WEEKLY_HOURS_EXCEEDED:
    "This would put you over your weekly hours limit. You've reached the maximum hours you can work this week.",
  CONSECUTIVE_DAYS_EXCEEDED:
    "This would be too many days in a row. You need a day off between shifts.",
};
