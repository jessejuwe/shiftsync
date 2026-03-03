/**
 * Tests swap execution with mocked Prisma transaction client.
 */

import { executeSwap, type SwapExecuteInput } from "../swap-execute";

// Minimal mock types for Prisma tx
type MockTx = {
  shiftAssignment: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  staffSkill: { findMany: jest.Mock };
  certification: { findMany: jest.Mock };
  availabilityWindow: { findMany: jest.Mock };
  notification: { createMany: jest.Mock };
  auditLog: { createMany: jest.Mock };
};

function createMockTx(
  overrides: Partial<{
    initiatorAssignment: unknown;
    receiverAssignment: unknown;
    receiverAssignments: unknown[];
    receiverSkills: unknown[];
    receiverCerts: unknown[];
    receiverAvailability: unknown[];
    initiatorAssignments: unknown[];
    initiatorSkills: unknown[];
    initiatorCerts: unknown[];
    initiatorAvailability: unknown[];
    allStaffSkillsInitiator: unknown[];
    allCertsInitiatorLocation: unknown[];
    allStaffSkillsReceiver: unknown[];
    allCertsReceiverLocation: unknown[];
  }> = {},
): MockTx {
  const initiatorShift = {
    id: "shift-init",
    locationId: "loc1",
    startsAt: new Date("2024-01-15T09:00:00.000Z"),
    endsAt: new Date("2024-01-15T17:00:00.000Z"),
    requiredSkills: [{ skillId: "skill1" }],
  };

  const receiverShift = {
    id: "shift-rec",
    locationId: "loc1",
    startsAt: new Date("2024-01-16T09:00:00.000Z"),
    endsAt: new Date("2024-01-16T17:00:00.000Z"),
    requiredSkills: [{ skillId: "skill1" }],
  };

  const defaultInitiatorAssignment =
    overrides.initiatorAssignment !== undefined
      ? overrides.initiatorAssignment
      : {
          id: "assign-init",
          shiftId: "shift-init",
          userId: "initiator",
          shift: initiatorShift,
        };

  const defaultReceiverAssignment =
    overrides.receiverAssignment !== undefined
      ? overrides.receiverAssignment
      : {
          id: "assign-rec",
          shiftId: "shift-rec",
          userId: "receiver",
          shift: receiverShift,
        };

  const defaultReceiverAssignments = overrides.receiverAssignments ?? [];
  const defaultInitiatorAssignments = overrides.initiatorAssignments ?? [];

  const defaultReceiverSkills = overrides.receiverSkills ?? [
    { skillId: "skill1" },
  ];
  const defaultInitiatorSkills = overrides.initiatorSkills ?? [
    { skillId: "skill1" },
  ];

  const futureDate = new Date("2030-01-01");
  const defaultReceiverCerts = overrides.receiverCerts ?? [
    { locationId: "loc1", expiresAt: futureDate },
  ];
  const defaultInitiatorCerts = overrides.initiatorCerts ?? [
    { locationId: "loc1", expiresAt: futureDate },
  ];

  const defaultReceiverAvailability = overrides.receiverAvailability ?? [
    {
      locationId: "loc1",
      startsAt: new Date("1970-01-05T09:00:00.000Z"),
      endsAt: new Date("1970-01-05T17:00:00.000Z"),
      dayOfWeek: 1,
      isRecurring: true,
    },
  ];
  const defaultInitiatorAvailability = overrides.initiatorAvailability ?? [
    {
      locationId: "loc1",
      startsAt: new Date("1970-01-06T09:00:00.000Z"),
      endsAt: new Date("1970-01-06T17:00:00.000Z"),
      dayOfWeek: 2,
      isRecurring: true,
    },
  ];

  const defaultAllStaffSkillsInitiator = overrides.allStaffSkillsInitiator ?? [
    {
      userId: "receiver",
      skillId: "skill1",
      user: { id: "receiver", name: "Receiver", email: "r@x.com" },
    },
  ];
  const defaultAllStaffSkillsReceiver = overrides.allStaffSkillsReceiver ?? [
    {
      userId: "initiator",
      skillId: "skill1",
      user: { id: "initiator", name: "Initiator", email: "i@x.com" },
    },
  ];

  const defaultAllCertsInitiatorLocation =
    overrides.allCertsInitiatorLocation ?? [
      {
        userId: "receiver",
        user: { id: "receiver", name: "Receiver", email: "r@x.com" },
      },
    ];
  const defaultAllCertsReceiverLocation =
    overrides.allCertsReceiverLocation ?? [
      {
        userId: "initiator",
        user: { id: "initiator", name: "Initiator", email: "i@x.com" },
      },
    ];

  const findUniqueCalls: Array<{ where: { id: string } }> = [];
  const findUniqueImpl = jest.fn((args: { where: { id: string } }) => {
    findUniqueCalls.push(args);
    if (args.where.id === "assign-init")
      return Promise.resolve(defaultInitiatorAssignment);
    if (args.where.id === "assign-rec")
      return Promise.resolve(defaultReceiverAssignment);
    return Promise.resolve(null);
  });

  const shiftAssignmentFindMany = jest.fn((args: { where: unknown }) => {
    const where = args.where as Record<string, unknown>;
    if (where.userId === "receiver")
      return Promise.resolve(defaultReceiverAssignments);
    return Promise.resolve(defaultInitiatorAssignments);
  });

  const staffSkillFindMany = jest.fn((args: { where: unknown }) => {
    const where = args.where as Record<string, unknown>;
    if (where.userId === "receiver")
      return Promise.resolve(defaultReceiverSkills);
    if (where.userId === "initiator")
      return Promise.resolve(defaultInitiatorSkills);
    if ("skillId" in where)
      return Promise.resolve(defaultAllStaffSkillsInitiator);
    return Promise.resolve(defaultAllStaffSkillsReceiver);
  });

  const certificationFindMany = jest.fn((args: { where: unknown }) => {
    const where = args.where as Record<string, unknown>;
    if (where.userId === "receiver")
      return Promise.resolve(defaultReceiverCerts);
    if (where.userId === "initiator")
      return Promise.resolve(defaultInitiatorCerts);
    if ("locationId" in where && "expiresAt" in where)
      return Promise.resolve(defaultAllCertsInitiatorLocation);
    return Promise.resolve(defaultAllCertsReceiverLocation);
  });

  const availabilityWindowFindMany = jest.fn((args: { where: unknown }) => {
    const where = args.where as Record<string, unknown>;
    if (where.userId === "receiver")
      return Promise.resolve(defaultReceiverAvailability);
    return Promise.resolve(defaultInitiatorAvailability);
  });

  return {
    shiftAssignment: {
      findUnique: findUniqueImpl,
      findMany: shiftAssignmentFindMany,
      update: jest.fn().mockResolvedValue({}),
    },
    staffSkill: { findMany: staffSkillFindMany },
    certification: { findMany: certificationFindMany },
    availabilityWindow: { findMany: availabilityWindowFindMany },
    notification: { createMany: jest.fn().mockResolvedValue({}) },
    auditLog: { createMany: jest.fn().mockResolvedValue({}) },
  };
}

function createTxFromMock(mock: MockTx): Parameters<typeof executeSwap>[0] {
  return mock as unknown as Parameters<typeof executeSwap>[0];
}

const baseInput: SwapExecuteInput = {
  swapRequestId: "swap-1",
  initiatorId: "initiator",
  receiverId: "receiver",
  initiatorShiftId: "assign-init",
  receiverShiftId: "assign-rec",
};

describe("swap-execute domain", () => {
  describe("executeSwap", () => {
    it("returns error when initiator assignment not found", async () => {
      const mock = createMockTx({ initiatorAssignment: null });
      const tx = createTxFromMock(mock);
      const result = await executeSwap(tx, baseInput, "manager");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Initiator shift not found or invalid");
    });

    it("returns error when initiator assignment belongs to wrong user", async () => {
      const mock = createMockTx({
        initiatorAssignment: {
          id: "assign-init",
          shiftId: "shift-init",
          userId: "wrong-user",
          shift: {
            id: "shift-init",
            locationId: "loc1",
            startsAt: new Date("2024-01-15T09:00:00.000Z"),
            endsAt: new Date("2024-01-15T17:00:00.000Z"),
            requiredSkills: [{ skillId: "skill1" }],
          },
        },
      });
      const tx = createTxFromMock(mock);
      const result = await executeSwap(tx, baseInput, "manager");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Initiator shift not found or invalid");
    });

    it("returns error when receiver shift not found (swap)", async () => {
      const mock = createMockTx({ receiverAssignment: null });
      const tx = createTxFromMock(mock);
      const result = await executeSwap(tx, baseInput, "manager");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Receiver shift not found or invalid");
    });

    it("returns error when receiver shift belongs to wrong user (swap)", async () => {
      const mock = createMockTx({
        receiverAssignment: {
          id: "assign-rec",
          shiftId: "shift-rec",
          userId: "wrong-user",
          shift: {
            id: "shift-rec",
            locationId: "loc1",
            startsAt: new Date("2024-01-16T09:00:00.000Z"),
            endsAt: new Date("2024-01-16T17:00:00.000Z"),
            requiredSkills: [{ skillId: "skill1" }],
          },
        },
      });
      const tx = createTxFromMock(mock);
      const result = await executeSwap(tx, baseInput, "manager");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Receiver shift not found or invalid");
    });

    it("returns validation blocks when receiver cannot take initiator shift", async () => {
      const mock = createMockTx({
        receiverSkills: [], // Receiver missing required skill
      });
      const tx = createTxFromMock(mock);
      const result = await executeSwap(tx, baseInput, "manager");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Receiver cannot take initiator shift.");
      expect(result.validationBlocks).toBeDefined();
      expect(result.validationBlocks!.length).toBeGreaterThan(0);
      expect(
        result.validationBlocks!.some((b) => b.code === "SKILL_MISMATCH"),
      ).toBe(true);
    });

    it("returns validation blocks when initiator cannot take receiver shift", async () => {
      const mock = createMockTx({
        initiatorSkills: [], // Initiator missing required skill for receiver shift
      });
      const tx = createTxFromMock(mock);
      const result = await executeSwap(tx, baseInput, "manager");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Initiator cannot take receiver shift.");
      expect(result.validationBlocks).toBeDefined();
    });

    it("succeeds for drop (receiverShiftId null) when receiver can take initiator shift", async () => {
      const mock = createMockTx();
      const tx = createTxFromMock(mock);
      const dropInput: SwapExecuteInput = {
        ...baseInput,
        receiverShiftId: null,
      };
      const result = await executeSwap(tx, dropInput, "manager");
      expect(result.success).toBe(true);
      expect(mock.shiftAssignment.update).toHaveBeenCalledTimes(1);
      expect(mock.shiftAssignment.update).toHaveBeenCalledWith({
        where: { id: "assign-init" },
        data: { userId: "receiver" },
      });
      expect(mock.notification.createMany).toHaveBeenCalled();
      expect(mock.auditLog.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              changes: expect.objectContaining({ type: "drop" }),
            }),
          ]),
        }),
      );
    });

    it("succeeds for swap when both parties pass validation", async () => {
      const mock = createMockTx();
      const tx = createTxFromMock(mock);
      const result = await executeSwap(tx, baseInput, "manager");
      expect(result.success).toBe(true);
      expect(mock.shiftAssignment.update).toHaveBeenCalledTimes(2);
      expect(mock.shiftAssignment.update).toHaveBeenNthCalledWith(1, {
        where: { id: "assign-init" },
        data: { userId: "receiver" },
      });
      expect(mock.shiftAssignment.update).toHaveBeenNthCalledWith(2, {
        where: { id: "assign-rec" },
        data: { userId: "initiator" },
      });
      expect(mock.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              userId: "receiver",
              title: "Swap completed",
            }),
            expect.objectContaining({
              userId: "initiator",
              title: "Swap completed",
            }),
          ]),
        }),
      );
      expect(mock.auditLog.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              action: "SWAP_EXECUTE",
              entityType: "SwapRequest",
              entityId: "swap-1",
              changes: expect.objectContaining({
                type: "swap",
                initiatorId: "initiator",
                receiverId: "receiver",
              }),
            }),
          ]),
        }),
      );
    });

    it("allows 7th consecutive day override when overrideReason provided", async () => {
      // Receiver has 6 consecutive days (Jan 10-15); initiator shift on Jan 16 would be 7th
      const initiatorShiftFor7th = {
        id: "shift-init",
        locationId: "loc1",
        startsAt: new Date("2024-01-16T09:00:00.000Z"),
        endsAt: new Date("2024-01-16T17:00:00.000Z"),
        requiredSkills: [{ skillId: "skill1" }],
      };
      const mock = createMockTx({
        initiatorAssignment: {
          id: "assign-init",
          shiftId: "shift-init",
          userId: "initiator",
          shift: initiatorShiftFor7th,
        },
        receiverAssignments: Array.from({ length: 6 }, (_, i) => ({
          id: `a${i}`,
          shiftId: `s${i}`,
          userId: "receiver",
          shift: {
            startsAt: new Date(`2024-01-${10 + i}T09:00:00.000Z`),
            endsAt: new Date(`2024-01-${10 + i}T17:00:00.000Z`),
          },
        })),
      });
      const tx = createTxFromMock(mock);
      const result = await executeSwap(
        tx,
        {
          ...baseInput,
          receiverShiftId: null,
          overrideReason: "Emergency coverage approved",
        },
        "manager",
      );
      expect(result.success).toBe(true);
      expect(mock.auditLog.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              changes: expect.objectContaining({
                override7thDay: true,
                overrideReason: "Emergency coverage approved",
              }),
            }),
          ]),
        }),
      );
    });
  });
});
