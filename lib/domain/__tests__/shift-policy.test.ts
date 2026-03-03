/**
 * Tests shift assignment validation: double booking, rest, skills, certification, availability, overtime, consecutive days.
 */

import {
  checkDoubleBooking,
  checkRestPeriod,
  checkSkillMatch,
  checkLocationCertification,
  checkAvailability,
  checkOvertimeWarnings,
  checkDailyHoursLimit,
  checkConsecutiveDays,
  validateShiftAssignment,
  type PolicyShift,
  type PolicyAssignment,
  type PolicyCertification,
  type PolicyAvailabilityWindow,
} from "../shift-policy";

function shift(
  id: string,
  locationId: string,
  start: string,
  end: string,
  skillIds: string[] = [],
  skillNames?: Array<{ id: string; name: string }>,
): PolicyShift {
  const s: PolicyShift = {
    id,
    locationId,
    requiredSkillIds: skillIds,
    startsAt: new Date(start),
    endsAt: new Date(end),
  };
  if (skillNames) s.requiredSkillNames = skillNames;
  return s;
}

function assignment(
  id: string,
  shiftId: string,
  userId: string,
  start: string,
  end: string,
): PolicyAssignment {
  return {
    id,
    shiftId,
    userId,
    startsAt: new Date(start),
    endsAt: new Date(end),
  };
}

describe("shift-policy domain", () => {
  describe("checkDoubleBooking", () => {
    it("returns null when no overlapping assignments", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T09:00:00.000Z",
        "2024-01-15T17:00:00.000Z",
      );
      const userAssignments: PolicyAssignment[] = [
        assignment(
          "a1",
          "s2",
          "u1",
          "2024-01-16T09:00:00.000Z",
          "2024-01-16T17:00:00.000Z",
        ),
      ];
      expect(checkDoubleBooking(s, userAssignments)).toBeNull();
    });

    it("returns block when shift overlaps existing assignment", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T10:00:00.000Z",
        "2024-01-15T18:00:00.000Z",
      );
      const userAssignments: PolicyAssignment[] = [
        assignment(
          "a1",
          "s2",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ),
      ];
      const result = checkDoubleBooking(s, userAssignments);
      expect(result).not.toBeNull();
      expect(result!.code).toBe("DOUBLE_BOOKING");
      expect(result!.type).toBe("block");
    });

    it("excludes assignment by id when excludeAssignmentId provided", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T09:00:00.000Z",
        "2024-01-15T17:00:00.000Z",
      );
      const userAssignments: PolicyAssignment[] = [
        assignment(
          "a1",
          "s1",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ), // same shift
      ];
      expect(checkDoubleBooking(s, userAssignments, "a1")).toBeNull();
    });
  });

  describe("checkRestPeriod", () => {
    it("returns null when sufficient rest (>= 10h)", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-16T09:00:00.000Z",
        "2024-01-16T17:00:00.000Z",
      );
      const userAssignments: PolicyAssignment[] = [
        assignment(
          "a1",
          "s2",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ), // ends 17:00, next starts 09:00 next day = 16h
      ];
      expect(checkRestPeriod(s, userAssignments)).toBeNull();
    });

    it("returns block when rest < 10h", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T19:00:00.000Z",
        "2024-01-15T23:00:00.000Z",
      ); // 4h shift
      const userAssignments: PolicyAssignment[] = [
        assignment(
          "a1",
          "s2",
          "u1",
          "2024-01-15T06:00:00.000Z",
          "2024-01-15T10:00:00.000Z",
        ), // ends 10:00, 9h before shift start
      ];
      const result = checkRestPeriod(s, userAssignments);
      expect(result).not.toBeNull();
      expect(result!.code).toBe("REST_VIOLATION");
    });
  });

  describe("checkSkillMatch", () => {
    it("returns null when user has all required skills", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T09:00:00.000Z",
        "2024-01-15T17:00:00.000Z",
        ["skill1", "skill2"],
      );
      const userSkillIds = ["skill1", "skill2"];
      const allUsers = [
        {
          id: "u1",
          name: "Alice",
          email: "a@x.com",
          skillIds: ["skill1", "skill2"],
        },
      ];
      expect(checkSkillMatch(s, userSkillIds, allUsers)).toBeNull();
    });

    it("returns block when user missing required skills", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T09:00:00.000Z",
        "2024-01-15T17:00:00.000Z",
        ["skill1", "skill2"],
        [
          { id: "skill1", name: "Kitchen" },
          { id: "skill2", name: "Bar" },
        ],
      );
      const userSkillIds = ["skill1"];
      const allUsers = [
        { id: "u1", name: "Alice", email: "a@x.com", skillIds: ["skill1"] },
        {
          id: "u2",
          name: "Bob",
          email: "b@x.com",
          skillIds: ["skill1", "skill2"],
        },
      ];
      const result = checkSkillMatch(s, userSkillIds, allUsers, "Alice");
      expect(result).not.toBeNull();
      expect(result!.code).toBe("SKILL_MISMATCH");
      expect(result!.message).toContain("Bar");
      expect(result!.suggestions).toHaveLength(1);
      expect(result!.suggestions![0].name).toBe("Bob");
    });
  });

  describe("checkLocationCertification", () => {
    it("returns null when user has valid certification", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T09:00:00.000Z",
        "2024-01-15T17:00:00.000Z",
      );
      const certs: PolicyCertification[] = [
        { userId: "u1", locationId: "loc1", expiresAt: new Date("2025-01-01") },
      ];
      const now = new Date("2024-01-01");
      const allUsers = [
        { id: "u2", name: "Bob", email: "b@x.com", hasValidCert: true },
      ];
      expect(checkLocationCertification(s, certs, now, allUsers)).toBeNull();
    });

    it("returns block when user has no valid certification", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T09:00:00.000Z",
        "2024-01-15T17:00:00.000Z",
      );
      const certs: PolicyCertification[] = [];
      const now = new Date("2024-01-01");
      const allUsers = [
        { id: "u2", name: "Bob", email: "b@x.com", hasValidCert: true },
      ];
      const result = checkLocationCertification(s, certs, now, allUsers);
      expect(result).not.toBeNull();
      expect(result!.code).toBe("CERTIFICATION_REQUIRED");
      expect(result!.suggestions).toHaveLength(1);
    });

    it("rejects expired certification", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T09:00:00.000Z",
        "2024-01-15T17:00:00.000Z",
      );
      const certs: PolicyCertification[] = [
        { userId: "u1", locationId: "loc1", expiresAt: new Date("2023-06-01") },
      ];
      const now = new Date("2024-01-01");
      const allUsers: Array<{
        id: string;
        name: string;
        email: string;
        hasValidCert: boolean;
      }> = [];
      const result = checkLocationCertification(s, certs, now, allUsers);
      expect(result).not.toBeNull();
    });
  });

  describe("checkAvailability", () => {
    it("returns null when shift falls within recurring window", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T10:00:00.000Z",
        "2024-01-15T14:00:00.000Z",
      ); // Mon 10-14
      const windows: PolicyAvailabilityWindow[] = [
        {
          userId: "u1",
          locationId: "loc1",
          startsAt: new Date("1970-01-05T09:00:00.000Z"), // Mon 9am
          endsAt: new Date("1970-01-05T17:00:00.000Z"), // Mon 5pm
          dayOfWeek: 1,
          isRecurring: true,
        },
      ];
      const allUsers = [
        { id: "u1", name: "Alice", email: "a@x.com", hasAvailability: true },
      ];
      expect(checkAvailability(s, windows, allUsers)).toBeNull();
    });

    it("returns warning when shift outside availability", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T22:00:00.000Z",
        "2024-01-16T06:00:00.000Z",
      ); // Mon night
      const windows: PolicyAvailabilityWindow[] = [
        {
          userId: "u1",
          locationId: "loc1",
          startsAt: new Date("1970-01-05T09:00:00.000Z"),
          endsAt: new Date("1970-01-05T17:00:00.000Z"),
          dayOfWeek: 1,
          isRecurring: true,
        },
      ];
      const allUsers = [
        { id: "u2", name: "Bob", email: "b@x.com", hasAvailability: true },
      ];
      const result = checkAvailability(s, windows, allUsers);
      expect(result).not.toBeNull();
      expect(result!.code).toBe("AVAILABILITY_VIOLATION");
      expect(result!.type).toBe("warning");
    });
  });

  describe("checkOvertimeWarnings", () => {
    it("returns null when under 40h", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-19T09:00:00.000Z",
        "2024-01-19T17:00:00.000Z",
      ); // 8h
      const userAssignmentsInWeek: PolicyAssignment[] = [
        assignment(
          "a1",
          "s2",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ), // 8h
        assignment(
          "a2",
          "s3",
          "u1",
          "2024-01-16T09:00:00.000Z",
          "2024-01-16T17:00:00.000Z",
        ), // 8h
        assignment(
          "a3",
          "s4",
          "u1",
          "2024-01-17T09:00:00.000Z",
          "2024-01-17T17:00:00.000Z",
        ), // 8h = 24h
      ];
      expect(checkOvertimeWarnings(s, userAssignmentsInWeek)).toBeNull(); // 24 + 8 = 32h
    });

    it("returns warning at 40h", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-19T09:00:00.000Z",
        "2024-01-19T17:00:00.000Z",
      );
      const userAssignmentsInWeek: PolicyAssignment[] = Array.from(
        { length: 4 },
        (_, i) =>
          assignment(
            `a${i}`,
            `s${i}`,
            "u1",
            `2024-01-${15 + i}T09:00:00.000Z`,
            `2024-01-${15 + i}T17:00:00.000Z`,
          ),
      ); // 32h
      const result = checkOvertimeWarnings(s, userAssignmentsInWeek);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("warning");
      expect(result!.code).toBe("WEEKLY_HOURS_EXCEEDED");
    });

    it("returns block at 48h", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-20T09:00:00.000Z",
        "2024-01-20T17:00:00.000Z",
      );
      const userAssignmentsInWeek: PolicyAssignment[] = Array.from(
        { length: 5 },
        (_, i) =>
          assignment(
            `a${i}`,
            `s${i}`,
            "u1",
            `2024-01-${15 + i}T09:00:00.000Z`,
            `2024-01-${15 + i}T17:00:00.000Z`,
          ),
      ); // 40h
      const result = checkOvertimeWarnings(s, userAssignmentsInWeek);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("block");
    });
  });

  describe("checkDailyHoursLimit", () => {
    it("returns null when under 8h", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T14:00:00.000Z",
        "2024-01-15T18:00:00.000Z",
      ); // 4h
      const userAssignments: PolicyAssignment[] = [
        assignment(
          "a1",
          "s2",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T13:00:00.000Z",
        ), // 4h
      ];
      expect(checkDailyHoursLimit(s, userAssignments)).toBeNull();
    });

    it("returns warning when over 8h but under 12h", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T14:00:00.000Z",
        "2024-01-15T18:00:00.000Z",
      ); // 4h
      const userAssignments: PolicyAssignment[] = [
        assignment(
          "a1",
          "s2",
          "u1",
          "2024-01-15T09:00:00.000Z",
          "2024-01-15T17:00:00.000Z",
        ), // 8h
      ];
      const result = checkDailyHoursLimit(s, userAssignments);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("warning");
      expect(result!.code).toBe("DAILY_HOURS_WARNING");
    });

    it("returns block when over 12h", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T14:00:00.000Z",
        "2024-01-15T22:00:00.000Z",
      ); // 8h
      const userAssignments: PolicyAssignment[] = [
        assignment(
          "a1",
          "s2",
          "u1",
          "2024-01-15T06:00:00.000Z",
          "2024-01-15T14:00:00.000Z",
        ), // 8h
      ];
      const result = checkDailyHoursLimit(s, userAssignments);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("block");
      expect(result!.code).toBe("DAILY_HOURS_EXCEEDED");
    });
  });

  describe("checkConsecutiveDays", () => {
    it("returns null when under 6 consecutive", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-20T09:00:00.000Z",
        "2024-01-20T17:00:00.000Z",
      );
      const userAssignments: PolicyAssignment[] = Array.from(
        { length: 4 },
        (_, i) =>
          assignment(
            `a${i}`,
            `s${i}`,
            "u1",
            `2024-01-${15 + i}T09:00:00.000Z`,
            `2024-01-${15 + i}T17:00:00.000Z`,
          ),
      );
      expect(checkConsecutiveDays(s, userAssignments)).toBeNull();
    });

    it("returns warning at 6th consecutive day", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-20T09:00:00.000Z",
        "2024-01-20T17:00:00.000Z",
      );
      const userAssignments: PolicyAssignment[] = Array.from(
        { length: 5 },
        (_, i) =>
          assignment(
            `a${i}`,
            `s${i}`,
            "u1",
            `2024-01-${15 + i}T09:00:00.000Z`,
            `2024-01-${15 + i}T17:00:00.000Z`,
          ),
      );
      const result = checkConsecutiveDays(s, userAssignments);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("warning");
      expect(result!.metadata?.is6thDay).toBe(true);
    });

    it("returns block at 7th consecutive day", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-21T09:00:00.000Z",
        "2024-01-21T17:00:00.000Z",
      );
      const userAssignments: PolicyAssignment[] = Array.from(
        { length: 6 },
        (_, i) =>
          assignment(
            `a${i}`,
            `s${i}`,
            "u1",
            `2024-01-${15 + i}T09:00:00.000Z`,
            `2024-01-${15 + i}T17:00:00.000Z`,
          ),
      );
      const result = checkConsecutiveDays(s, userAssignments);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("block");
      expect(result!.metadata?.requiresOverride).toBe(true);
    });
  });

  describe("validateShiftAssignment", () => {
    it("returns valid when all checks pass", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T09:00:00.000Z",
        "2024-01-15T17:00:00.000Z",
        ["skill1"],
      );
      const input = {
        shift: s,
        userId: "u1",
        userName: "Alice",
        userSkillIds: ["skill1"],
        userCertifications: [
          {
            userId: "u1",
            locationId: "loc1",
            expiresAt: new Date("2025-01-01"),
          },
        ],
        userAvailabilityWindows: [
          {
            userId: "u1",
            locationId: "loc1",
            startsAt: new Date("1970-01-05T09:00:00.000Z"),
            endsAt: new Date("1970-01-05T17:00:00.000Z"),
            dayOfWeek: 1,
            isRecurring: true,
          },
        ],
        userAssignments: [],
        userAssignmentsInWeek: [],
        allUsersWithSkills: [
          { id: "u1", name: "Alice", email: "a@x.com", skillIds: ["skill1"] },
        ],
        allUsersWithLocationCerts: [
          { id: "u1", name: "Alice", email: "a@x.com", hasValidCert: true },
        ],
        allUsersWithAvailability: [
          { id: "u1", name: "Alice", email: "a@x.com", hasAvailability: true },
        ],
        now: new Date("2024-01-01"), // Ensure cert not expired when test runs
      };
      const result = validateShiftAssignment(input);
      expect(result.valid).toBe(true);
      expect(result.blocks).toHaveLength(0);
    });

    it("returns blocks when double booking", () => {
      const s = shift(
        "s1",
        "loc1",
        "2024-01-15T10:00:00.000Z",
        "2024-01-15T18:00:00.000Z",
      );
      const input = {
        shift: s,
        userId: "u1",
        userSkillIds: [],
        userCertifications: [
          {
            userId: "u1",
            locationId: "loc1",
            expiresAt: new Date("2025-01-01"),
          },
        ],
        userAvailabilityWindows: [],
        userAssignments: [
          assignment(
            "a1",
            "s2",
            "u1",
            "2024-01-15T09:00:00.000Z",
            "2024-01-15T17:00:00.000Z",
          ),
        ],
        userAssignmentsInWeek: [],
        allUsersWithSkills: [],
        allUsersWithLocationCerts: [
          { id: "u1", name: "Alice", email: "a@x.com", hasValidCert: true },
        ],
        allUsersWithAvailability: [],
      };
      const result = validateShiftAssignment(input);
      expect(result.valid).toBe(false);
      expect(result.blocks.some((b) => b.code === "DOUBLE_BOOKING")).toBe(true);
    });
  });
});
