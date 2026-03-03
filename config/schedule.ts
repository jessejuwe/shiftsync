/**
 * Schedule-related configuration.
 * Unpublish/edit cutoff: managers cannot unpublish or edit shifts within this many hours of shift start.
 * Set NEXT_PUBLIC_UNPUBLISH_EDIT_CUTOFF_HOURS for client+server, or UNPUBLISH_EDIT_CUTOFF_HOURS for server-only.
 */
export const SCHEDULE_CONFIG = {
  /** Hours before shift start after which unpublish/edit is blocked. Default 48. */
  unpublishEditCutoffHours:
    Number(
      process.env.NEXT_PUBLIC_UNPUBLISH_EDIT_CUTOFF_HOURS ??
        process.env.UNPUBLISH_EDIT_CUTOFF_HOURS
    ) || 48,
} as const;

export function canUnpublishOrEdit(shiftStartsAt: Date): boolean {
  const cutoffMs =
    SCHEDULE_CONFIG.unpublishEditCutoffHours * 60 * 60 * 1000;
  const now = new Date();
  return now.getTime() < new Date(shiftStartsAt).getTime() - cutoffMs;
}
