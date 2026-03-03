/**
 * Ensures all ValidationCodes have labels and staff messages (regression guard).
 */

import {
  VALIDATION_LABELS,
  STAFF_PICKUP_MESSAGES,
  HEADCOUNT_EXCEEDED_MESSAGE,
} from "../validation-messages";
import type { ValidationCode } from "../domain/shift-policy";

const ALL_VALIDATION_CODES: ValidationCode[] = [
  "DOUBLE_BOOKING",
  "REST_VIOLATION",
  "SKILL_MISMATCH",
  "CERTIFICATION_REQUIRED",
  "AVAILABILITY_VIOLATION",
  "NO_AVAILABILITY_SET",
  "DAILY_HOURS_EXCEEDED",
  "DAILY_HOURS_WARNING",
  "WEEKLY_HOURS_EXCEEDED",
  "CONSECUTIVE_DAYS_EXCEEDED",
];

describe("validation-messages", () => {
  describe("VALIDATION_LABELS", () => {
    it("has a label for every ValidationCode", () => {
      for (const code of ALL_VALIDATION_CODES) {
        expect(VALIDATION_LABELS[code]).toBeDefined();
        expect(typeof VALIDATION_LABELS[code]).toBe("string");
        expect(VALIDATION_LABELS[code].length).toBeGreaterThan(0);
      }
    });
  });

  describe("STAFF_PICKUP_MESSAGES", () => {
    it("has a staff message for every ValidationCode", () => {
      for (const code of ALL_VALIDATION_CODES) {
        expect(STAFF_PICKUP_MESSAGES[code]).toBeDefined();
        expect(typeof STAFF_PICKUP_MESSAGES[code]).toBe("string");
        expect(STAFF_PICKUP_MESSAGES[code].length).toBeGreaterThan(0);
      }
    });
  });

  describe("HEADCOUNT_EXCEEDED_MESSAGE", () => {
    it("is a non-empty string", () => {
      expect(HEADCOUNT_EXCEEDED_MESSAGE).toBeDefined();
      expect(typeof HEADCOUNT_EXCEEDED_MESSAGE).toBe("string");
      expect(HEADCOUNT_EXCEEDED_MESSAGE).toContain("full");
    });
  });
});
