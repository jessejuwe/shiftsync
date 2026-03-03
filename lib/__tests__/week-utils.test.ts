/**
 * Tests week boundary utilities (UTC).
 */

import { getWeekStartUTC, getWeekRangeISO } from "../week-utils";

describe("week-utils", () => {
  // Use fixed date for deterministic tests
  const originalDate = Date;
  beforeAll(() => {
    (global as any).Date = class extends originalDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super("2024-01-15T12:00:00.000Z"); // Monday Jan 15, 2024
        } else {
          super(...(args as ConstructorParameters<typeof Date>));
        }
      }
      static now() {
        return new originalDate("2024-01-15T12:00:00.000Z").getTime();
      }
    };
  });

  afterAll(() => {
    (global as any).Date = originalDate;
  });

  describe("getWeekStartUTC", () => {
    it("returns Monday 00:00 UTC for current week when weekOffset is 0", () => {
      const result = getWeekStartUTC(0);
      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      // Jan 15 2024 is Monday, so week start is Jan 15 00:00 UTC
      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(15);
    });

    it("returns previous week when weekOffset is -1", () => {
      const result = getWeekStartUTC(-1);
      expect(result.getUTCDay()).toBe(1);
      expect(result.getUTCDate()).toBe(8); // Jan 8
    });

    it("returns next week when weekOffset is 1", () => {
      const result = getWeekStartUTC(1);
      expect(result.getUTCDay()).toBe(1);
      expect(result.getUTCDate()).toBe(22); // Jan 22
    });
  });

  describe("getWeekRangeISO", () => {
    it("returns from, to, and weekStart as ISO strings", () => {
      const result = getWeekRangeISO(0);
      expect(result).toHaveProperty("from");
      expect(result).toHaveProperty("to");
      expect(result).toHaveProperty("weekStart");

      const from = new Date(result.from);
      const to = new Date(result.to);
      const weekStart = new Date(result.weekStart);

      expect(from.getUTCDay()).toBe(1);
      expect(from.getUTCHours()).toBe(0);
      expect(from.getUTCMinutes()).toBe(0);

      expect(to.getUTCDay()).toBe(0); // Sunday
      expect(to.getUTCHours()).toBe(23);
      expect(to.getUTCMinutes()).toBe(59);
      expect(to.getUTCSeconds()).toBe(59);

      expect(weekStart.getTime()).toBe(from.getTime());
    });

    it("from is before to", () => {
      const result = getWeekRangeISO(0);
      expect(new Date(result.from).getTime()).toBeLessThan(
        new Date(result.to).getTime(),
      );
    });
  });
});
