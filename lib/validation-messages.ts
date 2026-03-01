import type { ValidationCode } from "@/lib/domain/shift-policy";

export const VALIDATION_LABELS: Record<ValidationCode, string> = {
  DOUBLE_BOOKING: "Double booking",
  REST_VIOLATION: "Rest period (<10h)",
  SKILL_MISMATCH: "Missing skills",
  CERTIFICATION_REQUIRED: "Location certification",
  AVAILABILITY_VIOLATION: "Outside availability",
  DAILY_HOURS_EXCEEDED: "Daily hours exceeded (>12h)",
  WEEKLY_HOURS_EXCEEDED: "Weekly hours (overtime)",
  CONSECUTIVE_DAYS_EXCEEDED: "Too many consecutive days",
};
