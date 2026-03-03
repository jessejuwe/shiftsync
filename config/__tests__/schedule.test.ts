/**
 * Unit tests for config/schedule.ts
 */

import { canUnpublishOrEdit, SCHEDULE_CONFIG } from "../schedule";

describe("schedule config", () => {
  describe("canUnpublishOrEdit", () => {
    const cutoffHours = SCHEDULE_CONFIG.unpublishEditCutoffHours;

    it("returns true when shift starts more than cutoff hours in the future", () => {
      const now = new Date("2024-01-15T12:00:00.000Z");
      const shiftStartsAt = new Date(now);
      shiftStartsAt.setHours(shiftStartsAt.getHours() + cutoffHours + 1);

      jest.useFakeTimers();
      jest.setSystemTime(now);
      expect(canUnpublishOrEdit(shiftStartsAt)).toBe(true);
      jest.useRealTimers();
    });

    it("returns false when shift starts within cutoff hours", () => {
      const now = new Date("2024-01-15T12:00:00.000Z");
      const shiftStartsAt = new Date(now);
      shiftStartsAt.setHours(shiftStartsAt.getHours() + cutoffHours - 1);

      jest.useFakeTimers();
      jest.setSystemTime(now);
      expect(canUnpublishOrEdit(shiftStartsAt)).toBe(false);
      jest.useRealTimers();
    });

    it("returns false when shift has already started", () => {
      const now = new Date("2024-01-15T12:00:00.000Z");
      const shiftStartsAt = new Date(now);
      shiftStartsAt.setHours(shiftStartsAt.getHours() - 1);

      jest.useFakeTimers();
      jest.setSystemTime(now);
      expect(canUnpublishOrEdit(shiftStartsAt)).toBe(false);
      jest.useRealTimers();
    });
  });
});
