/**
 * Tests fairness analytics: hours per staff, premium shifts, equity score.
 */

import {
  totalHoursPerStaff,
  premiumShiftsPerStaff,
  desiredHoursDelta,
  equityScore,
  DEFAULT_FAIRNESS_CONFIG,
  type AssignmentLike,
} from "../fairness";

function assignment(
  id: string,
  shiftId: string,
  userId: string,
  start: string,
  end: string,
  timezone?: string,
): AssignmentLike {
  const a: AssignmentLike = {
    id,
    shiftId,
    userId,
    startsAt: new Date(start),
    endsAt: new Date(end),
  };
  if (timezone) a.timezone = timezone;
  return a;
}

describe("fairness domain", () => {
  describe("totalHoursPerStaff", () => {
    it("returns empty map for no assignments", () => {
      const result = totalHoursPerStaff([]);
      expect(result.size).toBe(0);
    });

    it("sums hours per user", () => {
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
          "2024-01-16T13:00:00.000Z",
        ), // 4h
        assignment(
          "a3",
          "s3",
          "u2",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ), // 8h
      ];
      const result = totalHoursPerStaff(assignments);
      expect(result.get("u1")).toBe(12);
      expect(result.get("u2")).toBe(8);
    });
  });

  describe("premiumShiftsPerStaff", () => {
    it("returns empty map when no premium shifts", () => {
      // Monday 9am UTC - not Fri/Sat evening
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ),
      ];
      const result = premiumShiftsPerStaff(assignments);
      expect(result.get("u1")).toBeUndefined();
    });

    it("counts Friday evening shift (UTC) as premium", () => {
      // Friday Jan 19, 2024, 17:00 UTC = 5pm
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-19T17:00:00.000Z",
          "2024-01-19T23:00:00.000Z",
        ),
      ];
      const result = premiumShiftsPerStaff(assignments);
      expect(result.get("u1")).toBe(1);
    });

    it("counts Saturday evening shift as premium", () => {
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-20T18:00:00.000Z",
          "2024-01-21T02:00:00.000Z",
        ),
      ];
      const result = premiumShiftsPerStaff(assignments);
      expect(result.get("u1")).toBe(1);
    });

    it("does not count Friday morning as premium", () => {
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-19T09:00:00.000Z",
          "2024-01-19T17:00.000Z",
        ),
      ];
      const result = premiumShiftsPerStaff(assignments);
      expect(result.get("u1")).toBeUndefined();
    });

    it("uses timezone when provided for premium detection", () => {
      // 2024-01-19 22:00 UTC = Friday 5pm Eastern
      const assignments: AssignmentLike[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-19T22:00:00.000Z",
          "2024-01-20T04:00:00.000Z",
          "America/New_York",
        ),
      ];
      const result = premiumShiftsPerStaff(assignments);
      expect(result.get("u1")).toBe(1);
    });
  });

  describe("desiredHoursDelta", () => {
    it("returns positive delta when over target", () => {
      const hoursPerStaff = new Map([
        ["u1", 45],
        ["u2", 35],
      ]);
      const result = desiredHoursDelta(hoursPerStaff, 40);
      expect(result.get("u1")).toBe(5);
      expect(result.get("u2")).toBe(-5);
    });

    it("uses per-user target when Map is provided", () => {
      const hoursPerStaff = new Map([
        ["u1", 35],
        ["u2", 45],
      ]);
      const desiredHours = new Map([
        ["u1", 40],
        ["u2", 30],
      ]);
      const result = desiredHoursDelta(hoursPerStaff, desiredHours);
      expect(result.get("u1")).toBe(-5);
      expect(result.get("u2")).toBe(15);
    });

    it("defaults to 40 when user not in desiredHours Map", () => {
      const hoursPerStaff = new Map([["u1", 50]]);
      const desiredHours = new Map([["u2", 30]]);
      const result = desiredHoursDelta(hoursPerStaff, desiredHours);
      expect(result.get("u1")).toBe(10); // 50 - 40 default
    });
  });

  describe("equityScore", () => {
    it("returns empty map for no staff", () => {
      const result = equityScore(new Map(), new Map());
      expect(result.size).toBe(0);
    });

    it("returns scores between 0 and 100", () => {
      const hoursPerStaff = new Map([
        ["u1", 40],
        ["u2", 40],
        ["u3", 40],
      ]);
      const premiumPerStaff = new Map([
        ["u1", 1],
        ["u2", 1],
        ["u3", 1],
      ]);
      const result = equityScore(hoursPerStaff, premiumPerStaff);
      for (const [, score] of result) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });

    it("gives higher score to staff closer to average hours and premium", () => {
      const hoursPerStaff = new Map([
        ["u1", 40],
        ["u2", 20],
        ["u3", 60],
      ]);
      const premiumPerStaff = new Map([
        ["u1", 2],
        ["u2", 0],
        ["u3", 2],
      ]);
      const result = equityScore(hoursPerStaff, premiumPerStaff);
      // u1 is most balanced (40h, 2 premium); u2 and u3 deviate more
      expect(result.get("u1")).toBeGreaterThanOrEqual(result.get("u2") ?? 0);
      expect(result.get("u1")).toBeGreaterThanOrEqual(result.get("u3") ?? 0);
    });

    it("handles staff with hours but no premium", () => {
      const hoursPerStaff = new Map([
        ["u1", 40],
        ["u2", 40],
      ]);
      const premiumPerStaff = new Map([["u1", 1]]);
      const result = equityScore(hoursPerStaff, premiumPerStaff);
      expect(result.has("u1")).toBe(true);
      expect(result.has("u2")).toBe(true);
    });
  });
});
