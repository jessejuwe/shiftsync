/**
 * Tests swap state machine: states, transitions, guards, expiration.
 */

import {
  SwapState,
  SwapEvent,
  isTerminalState,
  isPendingState,
  canCreateSwap,
  getDefaultExpiration,
  getDropExpiration,
  getSwapRequestExpiration,
  isExpired,
  transition,
  getValidEvents,
  toPrismaStatus,
  fromPrismaStatus,
  MAX_PENDING_SWAPS_PER_STAFF,
  SWAP_EXPIRATION_HOURS,
  DROP_EXPIRATION_HOURS_BEFORE_START,
} from "../swap-workflow";

function ctx(
  overrides: Partial<{
    initiatorId: string;
    receiverId: string;
    actorId: string;
    requiresManagerApproval: boolean;
    expiresAt: Date;
    now: Date;
  }> = {},
): {
  initiatorId: string;
  receiverId: string;
  actorId: string;
  requiresManagerApproval: boolean;
  expiresAt?: Date;
  now?: Date;
} {
  return {
    initiatorId: "init",
    receiverId: "recv",
    actorId: "init",
    requiresManagerApproval: false,
    ...overrides,
  };
}

describe("swap-workflow domain", () => {
  describe("isTerminalState", () => {
    it("returns true for APPROVED, CANCELLED, EXPIRED", () => {
      expect(isTerminalState(SwapState.APPROVED)).toBe(true);
      expect(isTerminalState(SwapState.CANCELLED)).toBe(true);
      expect(isTerminalState(SwapState.EXPIRED)).toBe(true);
    });

    it("returns false for non-terminal states", () => {
      expect(isTerminalState(SwapState.ACTIVE)).toBe(false);
      expect(isTerminalState(SwapState.REQUESTED)).toBe(false);
      expect(isTerminalState(SwapState.ACCEPTED)).toBe(false);
      expect(isTerminalState(SwapState.PENDING_MANAGER)).toBe(false);
    });
  });

  describe("isPendingState", () => {
    it("returns true for ACTIVE, REQUESTED, ACCEPTED, PENDING_MANAGER", () => {
      expect(isPendingState(SwapState.ACTIVE)).toBe(true);
      expect(isPendingState(SwapState.REQUESTED)).toBe(true);
      expect(isPendingState(SwapState.ACCEPTED)).toBe(true);
      expect(isPendingState(SwapState.PENDING_MANAGER)).toBe(true);
    });

    it("returns false for terminal states", () => {
      expect(isPendingState(SwapState.APPROVED)).toBe(false);
      expect(isPendingState(SwapState.CANCELLED)).toBe(false);
      expect(isPendingState(SwapState.EXPIRED)).toBe(false);
    });
  });

  describe("canCreateSwap", () => {
    it("returns valid when pending count < 3", () => {
      expect(canCreateSwap(0)).toEqual({ valid: true });
      expect(canCreateSwap(2)).toEqual({ valid: true });
    });

    it("returns invalid when pending count >= 3", () => {
      const result = canCreateSwap(MAX_PENDING_SWAPS_PER_STAFF);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Maximum");
      expect(result.error).toContain("3");
    });
  });

  describe("getDefaultExpiration", () => {
    it("returns createdAt + 24 hours", () => {
      const createdAt = new Date("2024-01-15T12:00:00.000Z");
      const expiresAt = getDefaultExpiration(createdAt);
      expect(expiresAt.getTime()).toBe(
        createdAt.getTime() + SWAP_EXPIRATION_HOURS * 60 * 60 * 1000,
      );
    });
  });

  describe("getDropExpiration", () => {
    it("returns shift start - 24 hours", () => {
      const shiftStartsAt = new Date("2024-01-16T09:00:00.000Z");
      const expiresAt = getDropExpiration(shiftStartsAt);
      const expected = new Date(shiftStartsAt);
      expected.setHours(
        expected.getHours() - DROP_EXPIRATION_HOURS_BEFORE_START,
      );
      expect(expiresAt.getTime()).toBe(expected.getTime());
    });
  });

  describe("getSwapRequestExpiration", () => {
    it("returns drop expiration when receiverShiftId is null", () => {
      const initiatorShiftStartsAt = new Date("2024-01-16T09:00:00.000Z");
      const createdAt = new Date("2024-01-15T12:00:00.000Z");
      const result = getSwapRequestExpiration({
        initiatorShiftStartsAt,
        receiverShiftId: null,
        createdAt,
      });
      expect(result.getTime()).toBe(
        getDropExpiration(initiatorShiftStartsAt).getTime(),
      );
    });

    it("returns default expiration when receiverShiftId is provided", () => {
      const initiatorShiftStartsAt = new Date("2024-01-16T09:00:00.000Z");
      const createdAt = new Date("2024-01-15T12:00:00.000Z");
      const result = getSwapRequestExpiration({
        initiatorShiftStartsAt,
        receiverShiftId: "recv-shift-1",
        createdAt,
      });
      expect(result.getTime()).toBe(getDefaultExpiration(createdAt).getTime());
    });
  });

  describe("isExpired", () => {
    it("returns true when now >= expiresAt", () => {
      const expiresAt = new Date("2024-01-15T12:00:00.000Z");
      const now = new Date("2024-01-15T13:00:00.000Z");
      expect(isExpired(expiresAt, now)).toBe(true);
    });

    it("returns false when now < expiresAt", () => {
      const expiresAt = new Date("2024-01-15T14:00:00.000Z");
      const now = new Date("2024-01-15T13:00:00.000Z");
      expect(isExpired(expiresAt, now)).toBe(false);
    });
  });

  describe("transition", () => {
    describe("ACTIVE", () => {
      it("SEND: succeeds when initiator and not expired", () => {
        const result = transition(SwapState.ACTIVE, SwapEvent.SEND, ctx());
        expect(result.success).toBe(true);
        expect(result.newState).toBe(SwapState.REQUESTED);
        expect(result.notifications).toHaveLength(1);
        expect(result.notifications[0].target).toBe("receiver");
      });

      it("SEND: fails when receiver tries to send", () => {
        const result = transition(
          SwapState.ACTIVE,
          SwapEvent.SEND,
          ctx({ actorId: "recv" }),
        );
        expect(result.success).toBe(false);
      });

      it("CANCEL: succeeds when initiator", () => {
        const result = transition(SwapState.ACTIVE, SwapEvent.CANCEL, ctx());
        expect(result.success).toBe(true);
        expect(result.newState).toBe(SwapState.CANCELLED);
      });
    });

    describe("REQUESTED", () => {
      it("ACCEPT: succeeds when receiver and not expired", () => {
        const result = transition(
          SwapState.REQUESTED,
          SwapEvent.ACCEPT,
          ctx({
            actorId: "recv",
            expiresAt: new Date("2025-01-01"),
            now: new Date("2024-06-01"), // Before expiration
          }),
        );
        expect(result.success).toBe(true);
        expect(result.newState).toBe(SwapState.ACCEPTED);
      });

      it("ACCEPT: fails when initiator tries to accept", () => {
        const result = transition(
          SwapState.REQUESTED,
          SwapEvent.ACCEPT,
          ctx({ actorId: "init" }),
        );
        expect(result.success).toBe(false);
      });

      it("REJECT: succeeds when receiver", () => {
        const result = transition(
          SwapState.REQUESTED,
          SwapEvent.REJECT,
          ctx({ actorId: "recv" }),
        );
        expect(result.success).toBe(true);
        expect(result.newState).toBe(SwapState.CANCELLED);
        expect(result.prismaStatusOverride).toBe("REJECTED");
      });

      it("CANCEL: succeeds when initiator", () => {
        const result = transition(
          SwapState.REQUESTED,
          SwapEvent.CANCEL,
          ctx({ actorId: "init" }),
        );
        expect(result.success).toBe(true);
        expect(result.newState).toBe(SwapState.CANCELLED);
      });

      it("SHIFT_EDITED: succeeds and cancels", () => {
        const result = transition(
          SwapState.REQUESTED,
          SwapEvent.SHIFT_EDITED,
          ctx(),
        );
        expect(result.success).toBe(true);
        expect(result.newState).toBe(SwapState.CANCELLED);
        expect(result.notifications).toHaveLength(2); // initiator + receiver
      });
    });

    describe("ACCEPTED", () => {
      it("CONFIRM: succeeds when no manager approval and receiver", () => {
        const result = transition(
          SwapState.ACCEPTED,
          SwapEvent.CONFIRM,
          ctx({ actorId: "recv", requiresManagerApproval: false }),
        );
        expect(result.success).toBe(true);
        expect(result.newState).toBe(SwapState.APPROVED);
      });

      it("CONFIRM: fails when manager approval required", () => {
        const result = transition(
          SwapState.ACCEPTED,
          SwapEvent.CONFIRM,
          ctx({ actorId: "recv", requiresManagerApproval: true }),
        );
        expect(result.success).toBe(false);
      });

      it("REQUEST_MANAGER_APPROVAL: succeeds when manager approval required and receiver", () => {
        const result = transition(
          SwapState.ACCEPTED,
          SwapEvent.REQUEST_MANAGER_APPROVAL,
          ctx({ actorId: "recv", requiresManagerApproval: true }),
        );
        expect(result.success).toBe(true);
        expect(result.newState).toBe(SwapState.PENDING_MANAGER);
      });

      it("CANCEL: succeeds when initiator or receiver", () => {
        const r1 = transition(
          SwapState.ACCEPTED,
          SwapEvent.CANCEL,
          ctx({ actorId: "init" }),
        );
        expect(r1.success).toBe(true);
        expect(r1.newState).toBe(SwapState.CANCELLED);
        const r2 = transition(
          SwapState.ACCEPTED,
          SwapEvent.CANCEL,
          ctx({ actorId: "recv" }),
        );
        expect(r2.success).toBe(true);
        expect(r2.newState).toBe(SwapState.CANCELLED);
      });
    });

    describe("PENDING_MANAGER", () => {
      it("MANAGER_APPROVE: succeeds when actor is manager", () => {
        const result = transition(
          SwapState.PENDING_MANAGER,
          SwapEvent.MANAGER_APPROVE,
          ctx({ actorId: "manager1" }),
        );
        expect(result.success).toBe(true);
        expect(result.newState).toBe(SwapState.APPROVED);
      });

      it("MANAGER_APPROVE: fails when actor is initiator", () => {
        const result = transition(
          SwapState.PENDING_MANAGER,
          SwapEvent.MANAGER_APPROVE,
          ctx({ actorId: "init" }),
        );
        expect(result.success).toBe(false);
      });

      it("MANAGER_REJECT: succeeds when actor is manager", () => {
        const result = transition(
          SwapState.PENDING_MANAGER,
          SwapEvent.MANAGER_REJECT,
          ctx({ actorId: "manager1" }),
        );
        expect(result.success).toBe(true);
        expect(result.newState).toBe(SwapState.CANCELLED);
        expect(result.prismaStatusOverride).toBe("REJECTED");
      });
    });

    describe("terminal states", () => {
      it("no transitions from APPROVED", () => {
        const result = transition(SwapState.APPROVED, SwapEvent.CANCEL, ctx());
        expect(result.success).toBe(false);
        expect(result.error).toContain("Transition not allowed");
      });

      it("no transitions from CANCELLED", () => {
        const result = transition(SwapState.CANCELLED, SwapEvent.SEND, ctx());
        expect(result.success).toBe(false);
      });
    });

    describe("invalid event", () => {
      it("returns error for unknown event", () => {
        const result = transition(SwapState.ACTIVE, "INVALID" as any, ctx());
        expect(result.success).toBe(false);
      });
    });
  });

  describe("getValidEvents", () => {
    it("returns SEND and CANCEL for ACTIVE when initiator", () => {
      const events = getValidEvents(SwapState.ACTIVE, ctx());
      expect(events).toContain(SwapEvent.SEND);
      expect(events).toContain(SwapEvent.CANCEL);
    });

    it("returns empty for APPROVED", () => {
      const events = getValidEvents(SwapState.APPROVED, ctx());
      expect(events).toHaveLength(0);
    });
  });

  describe("toPrismaStatus", () => {
    it("maps workflow states to Prisma status", () => {
      expect(toPrismaStatus(SwapState.APPROVED)).toBe("APPROVED");
      expect(toPrismaStatus(SwapState.PENDING_MANAGER)).toBe("PENDING_MANAGER");
      expect(toPrismaStatus(SwapState.CANCELLED)).toBe("CANCELLED");
      expect(toPrismaStatus(SwapState.EXPIRED)).toBe("CANCELLED");
      expect(toPrismaStatus(SwapState.REQUESTED)).toBe("PENDING");
      expect(toPrismaStatus(SwapState.ACCEPTED)).toBe("PENDING");
      expect(toPrismaStatus(SwapState.ACTIVE)).toBe("PENDING");
    });
  });

  describe("fromPrismaStatus", () => {
    it("maps Prisma status to workflow state", () => {
      expect(fromPrismaStatus("APPROVED")).toBe(SwapState.APPROVED);
      expect(fromPrismaStatus("PENDING_MANAGER")).toBe(
        SwapState.PENDING_MANAGER,
      );
      expect(fromPrismaStatus("CANCELLED")).toBe(SwapState.CANCELLED);
      expect(fromPrismaStatus("REJECTED")).toBe(SwapState.CANCELLED);
      expect(fromPrismaStatus("PENDING")).toBe(SwapState.REQUESTED);
    });
  });
});
