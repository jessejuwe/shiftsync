/**
 * Tests overtime calculations, weekly/daily hours, consecutive days, and what-if preview.
 */

import {
  calculateWeeklyHours,
  calculatePeriodHours,
  calculateProjectedWeeklyHours,
  calculateDailyHours,
  calculateProjectedDailyHours,
  calculateConsecutiveDaysCurrent,
  calculateConsecutiveDays,
  getWhatIfPreviewMessage,
  DEFAULT_OVERTIME_CONFIG,
  type AssignmentLike,
  type TimeRange,
} from "../overtime";

// Helper to create assignments with UTC dates
function assignment(
  id: string,
  shiftId: string,
  userId: string,
  start: string,
  end: string,
): AssignmentLike {
  return {
    id,
    shiftId,
    userId,
    startsAt: new Date(start),
    endsAt: new Date(end),
  };
}

function timeRange(start: string, end: string): TimeRange {
  return { startsAt: new Date(start), endsAt: new Date(end) };
}

describe("overtime domain", () => {
  describe("calculateWeeklyHours", () => {
    it("returns 0 for empty assignments", () => {
      const ref = new Date("2024-01-15T12:00:00.000Z"); // Monday
      expect(calculateWeeklyHours([], ref)).toBe(0);
    });

    it("sums hours for assignments in the same week (Mon–Sun)", () => {
      const ref = new Date("2024-01-15T12:00:00.000Z"); // Mon Jan 15
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ), // 8h Mon
        assignment(
          "a2",
          "s2",
          "u1",
          "2024-01-17T09:00:00.000Z",
          "2024-01-17T13:00:00.000Z",
        ), // 4h Wed
      ];
      expect(calculateWeeklyHours(assignments, ref)).toBe(12);
    });

    it("excludes assignments outside the week", () => {
      const ref = new Date("2024-01-15T12:00:00.000Z"); // Mon Jan 15
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ), // 8h
        assignment(
          "a2",
          "s2",
          "u1",
          "2024-01-08T09:00:00.000Z",
          "2024-01-08T17:00:00.000Z",
        ), // prev week
        assignment(
          "a3",
          "s3",
          "u1",
          "2024-01-22T09:00:00.000Z",
          "2024-01-22T17:00:00.000Z",
        ), // next week
      ];
      expect(calculateWeeklyHours(assignments, ref)).toBe(8);
    });

    it("excludes assignment by id when excludeAssignmentId is provided", () => {
      const ref = new Date("2024-01-15T12:00:00.000Z");
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ),
        assignment(
          "a2",
          "s2",
          "u1",
          "2024-01-16T09:00:00.000Z",
          "2024-01-16T17:00:00.000Z",
        ),
      ];
      expect(calculateWeeklyHours(assignments, ref, "a1")).toBe(8);
    });
  });

  describe("calculatePeriodHours", () => {
    it("returns 0 for empty assignments", () => {
      const start = new Date("2024-01-01T00:00:00.000Z");
      const end = new Date("2024-01-31T23:59:59.999Z");
      expect(calculatePeriodHours([], start, end)).toBe(0);
    });

    it("sums hours for assignments within period (inclusive)", () => {
      const start = new Date("2024-01-10T00:00:00.000Z");
      const end = new Date("2024-01-20T23:59:59.999Z");
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-12T09:00:00.000Z",
          "2024-01-12T17:00:00.000Z",
        ),
        assignment(
          "a2",
          "s2",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T13:00:00.000Z",
        ),
      ];
      expect(calculatePeriodHours(assignments, start, end)).toBe(12);
    });

    it("excludes assignments outside period", () => {
      const start = new Date("2024-01-10T00:00:00.000Z");
      const end = new Date("2024-01-20T23:59:59.999Z");
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-09T09:00:00.000Z",
          "2024-01-09T17:00:00.000Z",
        ),
        assignment(
          "a2",
          "s2",
          "u1",
          "2024-01-21T09:00:00.000Z",
          "2024-01-21T17:00:00.000Z",
        ),
      ];
      expect(calculatePeriodHours(assignments, start, end)).toBe(0);
    });
  });

  describe("calculateProjectedWeeklyHours", () => {
    it("returns current and projected hours without overtime when under warning", () => {
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ), // 8h
      ];
      const proposed = timeRange(
        "2024-01-16T09:00:00.000Z",
        "2024-01-16T13:00:00.000Z",
      ); // 4h
      const result = calculateProjectedWeeklyHours(assignments, proposed);
      expect(result.currentHours).toBe(8);
      expect(result.shiftHours).toBe(4);
      expect(result.projectedHours).toBe(12);
      expect(result.isOverWarning).toBe(false);
      expect(result.isOverBlock).toBe(false);
    });

    it("flags isOverWarning when projected >= 40h", () => {
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ), // 8h
        assignment(
          "a2",
          "s2",
          "u1",
          "2024-01-16T09:00:00.000Z",
          "2024-01-16T17:00:00.000Z",
        ), // 8h
        assignment(
          "a3",
          "s3",
          "u1",
          "2024-01-17T09:00:00.000Z",
          "2024-01-17T17:00:00.000Z",
        ), // 8h
        assignment(
          "a4",
          "s4",
          "u1",
          "2024-01-18T09:00:00.000Z",
          "2024-01-18T17:00:00.000Z",
        ), // 8h = 32h
      ];
      const proposed = timeRange(
        "2024-01-19T09:00:00.000Z",
        "2024-01-19T17:00:00.000Z",
      ); // 8h -> 40h
      const result = calculateProjectedWeeklyHours(assignments, proposed);
      expect(result.projectedHours).toBe(40);
      expect(result.isOverWarning).toBe(true);
      expect(result.overtimeHours).toBe(0);
    });

    it("flags isOverBlock when projected >= 48h", () => {
      const assignments: AssignmentLike[] = Array.from({ length: 5 }, (_, i) =>
        assignment(
          `a${i}`,
          `s${i}`,
          "u1",
          `2024-01-${15 + i}T09:00:00.000Z`,
          `2024-01-${15 + i}T17:00:00.000Z`,
        ),
      ); // 5 * 8 = 40h
      const proposed = timeRange(
        "2024-01-20T09:00:00.000Z",
        "2024-01-20T17:00:00.000Z",
      ); // 8h -> 48h
      const result = calculateProjectedWeeklyHours(assignments, proposed);
      expect(result.isOverBlock).toBe(true);
      expect(result.overtimeHours).toBe(8);
    });

    it("respects custom config", () => {
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ),
      ];
      const proposed = timeRange(
        "2024-01-16T09:00:00.000Z",
        "2024-01-16T17:00:00.000Z",
      );
      const result = calculateProjectedWeeklyHours(assignments, proposed, {
        overtimeWarningHoursPerWeek: 10,
      });
      expect(result.projectedHours).toBe(16);
      expect(result.isOverWarning).toBe(true);
    });
  });

  describe("calculateDailyHours", () => {
    it("returns 0 when no assignments on date", () => {
      const date = new Date("2024-01-15T12:00:00.000Z");
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-16T09:00:00.000Z",
          "2024-01-16T17:00:00.000Z",
        ),
      ];
      expect(calculateDailyHours(assignments, date)).toBe(0);
    });

    it("sums hours for same-day shift", () => {
      const date = new Date("2024-01-15T12:00:00.000Z");
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ),
      ];
      expect(calculateDailyHours(assignments, date)).toBe(8);
    });

    it("splits overnight shift across start and end dates", () => {
      const date = new Date("2024-01-15T12:00:00.000Z");
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-14T22:00:00.000Z",
          "2024-01-15T06:00:00.000Z",
        ), // 8h, 2h on 14th, 6h on 15th
      ];
      expect(calculateDailyHours(assignments, date)).toBe(6);
    });
  });

  describe("calculateProjectedDailyHours", () => {
    it("returns max projected across days the shift touches", () => {
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ), // 8h on 15th
      ];
      const proposed = timeRange(
        "2024-01-15T17:00:00.000Z",
        "2024-01-15T21:00:00.000Z",
      ); // 4h on 15th
      const result = calculateProjectedDailyHours(assignments, proposed);
      expect(result.currentHours).toBe(8);
      expect(result.shiftHours).toBe(4);
      expect(result.projectedHours).toBe(12);
    });

    it("handles overnight proposed shift", () => {
      const assignments: AssignmentLike[] = [];
      const proposed = timeRange(
        "2024-01-15T22:00:00.000Z",
        "2024-01-16T06:00:00.000Z",
      );
      const result = calculateProjectedDailyHours(assignments, proposed);
      // Overnight split: 2h on 15th, 6h on 16th; max projected on single day is 6
      expect(result.projectedHours).toBe(6);
    });
  });

  describe("calculateConsecutiveDaysCurrent", () => {
    it("returns 0 for empty assignments", () => {
      const result = calculateConsecutiveDaysCurrent([]);
      expect(result.maxConsecutive).toBe(0);
      expect(result.is6thDay).toBe(false);
      expect(result.is7thOrMore).toBe(false);
    });

    it("counts single day as 1 consecutive", () => {
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ),
      ];
      const result = calculateConsecutiveDaysCurrent(assignments);
      expect(result.maxConsecutive).toBe(1);
    });

    it("counts 6 consecutive days correctly", () => {
      const assignments: AssignmentLike[] = Array.from({ length: 6 }, (_, i) =>
        assignment(
          `a${i}`,
          `s${i}`,
          "u1",
          `2024-01-${15 + i}T09:00:00.000Z`,
          `2024-01-${15 + i}T17:00:00.000Z`,
        ),
      );
      const result = calculateConsecutiveDaysCurrent(assignments);
      expect(result.maxConsecutive).toBe(6);
      expect(result.is6thDay).toBe(true);
      expect(result.is7thOrMore).toBe(false);
    });

    it("counts 7+ consecutive days", () => {
      const assignments: AssignmentLike[] = Array.from({ length: 7 }, (_, i) =>
        assignment(
          `a${i}`,
          `s${i}`,
          "u1",
          `2024-01-${15 + i}T09:00:00.000Z`,
          `2024-01-${15 + i}T17:00:00.000Z`,
        ),
      );
      const result = calculateConsecutiveDaysCurrent(assignments);
      expect(result.maxConsecutive).toBe(7);
      expect(result.is7thOrMore).toBe(true);
    });

    it("resets streak when there is a gap", () => {
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ),
        assignment(
          "a2",
          "s2",
          "u1",
          "2024-01-16T09:00:00.000Z",
          "2024-01-16T17:00:00.000Z",
        ),
        assignment(
          "a3",
          "s3",
          "u1",
          "2024-01-18T09:00:00.000Z",
          "2024-01-18T17:00:00.000Z",
        ), // gap
      ];
      const result = calculateConsecutiveDaysCurrent(assignments);
      expect(result.maxConsecutive).toBe(2);
    });
  });

  describe("calculateConsecutiveDays", () => {
    it("returns exceedsLimit when proposed shift creates 7th consecutive day", () => {
      const assignments: AssignmentLike[] = Array.from({ length: 6 }, (_, i) =>
        assignment(
          `a${i}`,
          `s${i}`,
          "u1",
          `2024-01-${15 + i}T09:00:00.000Z`,
          `2024-01-${15 + i}T17:00:00.000Z`,
        ),
      );
      const proposed = timeRange(
        "2024-01-21T09:00:00.000Z",
        "2024-01-21T17:00:00.000Z",
      ); // 7th day
      const result = calculateConsecutiveDays(assignments, proposed);
      expect(result.maxConsecutive).toBe(7);
      expect(result.exceedsLimit).toBe(true);
      expect(result.limit).toBe(DEFAULT_OVERTIME_CONFIG.maxConsecutiveDays);
    });

    it("does not exceed limit at 6 consecutive days", () => {
      const assignments: AssignmentLike[] = Array.from({ length: 5 }, (_, i) =>
        assignment(
          `a${i}`,
          `s${i}`,
          "u1",
          `2024-01-${15 + i}T09:00:00.000Z`,
          `2024-01-${15 + i}T17:00:00.000Z`,
        ),
      );
      const proposed = timeRange(
        "2024-01-20T09:00:00.000Z",
        "2024-01-20T17:00:00.000Z",
      ); // 6th day
      const result = calculateConsecutiveDays(assignments, proposed);
      expect(result.maxConsecutive).toBe(6);
      expect(result.exceedsLimit).toBe(false);
    });
  });

  describe("getWhatIfPreviewMessage", () => {
    it("returns null when not over warning", () => {
      const projected = {
        currentHours: 30,
        shiftHours: 8,
        projectedHours: 38,
        overtimeHours: 0,
        overtimeWarningHours: 40,
        isOverWarning: false,
        isOverBlock: false,
      };
      expect(getWhatIfPreviewMessage("Alice", projected)).toBeNull();
    });

    it("returns message when over warning", () => {
      const projected = {
        currentHours: 38,
        shiftHours: 8,
        projectedHours: 46,
        overtimeHours: 6,
        overtimeWarningHours: 40,
        isOverWarning: true,
        isOverBlock: false,
      };
      const msg = getWhatIfPreviewMessage("Alice", projected);
      expect(msg).toContain("Alice");
      expect(msg).toContain("46");
      expect(msg).toContain("6");
      expect(msg).toContain("overtime");
    });
  });
});
