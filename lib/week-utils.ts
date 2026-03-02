/**
 * Week boundary utilities using UTC.
 * Ensures client and server agree on week boundaries regardless of user timezone.
 */
import { addWeeks } from "date-fns";

/**
 * Get Monday 00:00 UTC of the current week (or offset).
 * Use this for API params (weekStart) so client and server align.
 */
export function getWeekStartUTC(weekOffset = 0): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0, 0));
  if (weekOffset !== 0) {
    return addWeeks(monday, weekOffset);
  }
  return monday;
}

/**
 * Get week range as ISO strings for API calls.
 */
export function getWeekRangeISO(weekOffset = 0): { from: string; to: string; weekStart: string } {
  const monday = getWeekStartUTC(weekOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return {
    from: monday.toISOString(),
    to: sunday.toISOString(),
    weekStart: monday.toISOString(),
  };
}
