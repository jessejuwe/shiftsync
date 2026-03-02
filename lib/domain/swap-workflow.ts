/**
 * SwapRequestStateMachine - Pure state machine for swap request workflow.
 * All functions are pure and testable (no DB calls).
 */

// =============================================================================
// STATES
// =============================================================================

export const SwapState = {
  ACTIVE: "ACTIVE",
  REQUESTED: "REQUESTED",
  ACCEPTED: "ACCEPTED",
  PENDING_MANAGER: "PENDING_MANAGER",
  APPROVED: "APPROVED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

export type SwapStateType = (typeof SwapState)[keyof typeof SwapState];

export const TERMINAL_STATES: SwapStateType[] = [
  SwapState.APPROVED,
  SwapState.CANCELLED,
  SwapState.EXPIRED,
];

export function isTerminalState(state: SwapStateType): boolean {
  return TERMINAL_STATES.includes(state);
}

// =============================================================================
// ENFORCEMENT CONSTANTS
// =============================================================================

/** Max number of non-terminal swap requests per staff (initiator or receiver). */
export const MAX_PENDING_SWAPS_PER_STAFF = 3;

/** Expiration window in hours from creation. */
export const SWAP_EXPIRATION_HOURS = 24;

/** Non-terminal states that count toward the pending limit. */
export const PENDING_STATES: SwapStateType[] = [
  SwapState.ACTIVE,
  SwapState.REQUESTED,
  SwapState.ACCEPTED,
  SwapState.PENDING_MANAGER,
];

export function isPendingState(state: SwapStateType): boolean {
  return PENDING_STATES.includes(state);
}

/**
 * Check if a staff member can create a new swap (max 3 pending).
 * Pure function - pass in the count of their current pending swaps.
 */
export function canCreateSwap(pendingCount: number): { valid: boolean; error?: string } {
  if (pendingCount >= MAX_PENDING_SWAPS_PER_STAFF) {
    return {
      valid: false,
      error: `Maximum ${MAX_PENDING_SWAPS_PER_STAFF} pending swap requests allowed per staff.`,
    };
  }
  return { valid: true };
}

/**
 * Compute expiration timestamp from creation time.
 * Use this when creating a swap; pass the result in context.expiresAt.
 */
export function getDefaultExpiration(createdAt: Date = new Date()): Date {
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(expiresAt.getHours() + SWAP_EXPIRATION_HOURS);
  return expiresAt;
}

/**
 * Check if a swap has expired (for EXPIRE transition).
 */
export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now >= expiresAt;
}

// =============================================================================
// EVENTS / ACTIONS
// =============================================================================

export const SwapEvent = {
  SEND: "SEND",
  ACCEPT: "ACCEPT",
  REJECT: "REJECT",
  REQUEST_MANAGER_APPROVAL: "REQUEST_MANAGER_APPROVAL",
  CONFIRM: "CONFIRM", // Receiver confirms when no manager approval needed
  MANAGER_APPROVE: "MANAGER_APPROVE",
  MANAGER_REJECT: "MANAGER_REJECT",
  CANCEL: "CANCEL",
  EXPIRE: "EXPIRE",
  SHIFT_EDITED: "SHIFT_EDITED", // Auto-cancel when a shift involved in the swap is edited
} as const;

export type SwapEventType = (typeof SwapEvent)[keyof typeof SwapEvent];

// =============================================================================
// CONTEXT (input for guards)
// =============================================================================

export interface SwapContext {
  initiatorId: string;
  receiverId: string;
  actorId: string; // Who is performing the action (use "system" for SHIFT_EDITED)
  requiresManagerApproval: boolean;
  expiresAt?: Date; // When the swap expires (24h from creation)
  now?: Date; // For testing
}

// =============================================================================
// TRANSITION RESULT
// =============================================================================

export type NotificationTarget = "initiator" | "receiver" | "manager";

export interface NotificationTrigger {
  target: NotificationTarget;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface TransitionResult {
  success: boolean;
  newState?: SwapStateType;
  error?: string;
  notifications: NotificationTrigger[];
  /** Use REJECTED in Prisma when event was REJECT */
  prismaStatusOverride?: "REJECTED";
}

// =============================================================================
// TRANSITION GUARDS
// =============================================================================

function guardActorIsInitiator(ctx: SwapContext): boolean {
  return ctx.actorId === ctx.initiatorId;
}

function guardActorIsReceiver(ctx: SwapContext): boolean {
  return ctx.actorId === ctx.receiverId;
}

function guardActorIsManager(ctx: SwapContext): boolean {
  return ctx.actorId !== ctx.initiatorId && ctx.actorId !== ctx.receiverId;
}

function guardNotExpired(ctx: SwapContext): boolean {
  if (!ctx.expiresAt) return true;
  const now = ctx.now ?? new Date();
  return now < ctx.expiresAt;
}

// =============================================================================
// STATE TRANSITIONS (pure)
// =============================================================================

const TRANSITIONS: Record<
  SwapStateType,
  Partial<
    Record<
      SwapEventType,
      {
        guard: (ctx: SwapContext) => boolean;
        nextState: SwapStateType;
        notifications: (ctx: SwapContext) => NotificationTrigger[];
      }
    >
  >
> = {
  [SwapState.ACTIVE]: {
    [SwapEvent.SEND]: {
      guard: (ctx) => guardActorIsInitiator(ctx) && guardNotExpired(ctx),
      nextState: SwapState.REQUESTED,
      notifications: (ctx) => [
        {
          target: "receiver",
          type: "SWAP_REQUEST",
          title: "Swap request received",
          body: "Someone wants to swap shifts with you.",
          data: { initiatorId: ctx.initiatorId },
        },
      ],
    },
    [SwapEvent.CANCEL]: {
      guard: (ctx) => guardActorIsInitiator(ctx),
      nextState: SwapState.CANCELLED,
      notifications: (ctx) => [
        {
          target: "receiver",
          type: "SWAP_CANCELLED",
          title: "Swap request cancelled",
          body: "The swap request was cancelled before it was sent.",
          data: { initiatorId: ctx.initiatorId },
        },
      ],
    },
    [SwapEvent.EXPIRE]: {
      guard: () => true,
      nextState: SwapState.EXPIRED,
      notifications: () => [],
    },
  },

  [SwapState.REQUESTED]: {
    [SwapEvent.SHIFT_EDITED]: {
      guard: () => true,
      nextState: SwapState.CANCELLED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_CANCELLED",
          title: "Swap cancelled",
          body: "The swap was cancelled because a shift was edited.",
          data: {},
        },
        {
          target: "receiver",
          type: "SWAP_CANCELLED",
          title: "Swap cancelled",
          body: "The swap was cancelled because a shift was edited.",
          data: {},
        },
      ],
    },
    [SwapEvent.REJECT]: {
      guard: (ctx) => guardActorIsReceiver(ctx),
      nextState: SwapState.CANCELLED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_REJECTED",
          title: "Swap rejected",
          body: "The other party declined your swap request.",
          data: { receiverId: ctx.receiverId },
        },
      ],
    },
    [SwapEvent.ACCEPT]: {
      guard: (ctx) => guardActorIsReceiver(ctx) && guardNotExpired(ctx),
      nextState: SwapState.ACCEPTED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_ACCEPTED",
          title: "Swap accepted",
          body: "The other party accepted your swap request.",
          data: { receiverId: ctx.receiverId },
        },
      ],
    },
    [SwapEvent.CANCEL]: {
      guard: (ctx) => guardActorIsInitiator(ctx),
      nextState: SwapState.CANCELLED,
      notifications: (ctx) => [
        {
          target: "receiver",
          type: "SWAP_CANCELLED",
          title: "Swap request cancelled",
          body: "The initiator cancelled the swap request.",
          data: { initiatorId: ctx.initiatorId },
        },
      ],
    },
    [SwapEvent.EXPIRE]: {
      guard: (ctx) => !guardNotExpired(ctx),
      nextState: SwapState.EXPIRED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_EXPIRED",
          title: "Swap request expired",
          body: "Your swap request expired without a response.",
          data: {},
        },
        {
          target: "receiver",
          type: "SWAP_EXPIRED",
          title: "Swap request expired",
          body: "A swap request you received has expired.",
          data: {},
        },
      ],
    },
  },

  [SwapState.ACCEPTED]: {
    [SwapEvent.SHIFT_EDITED]: {
      guard: () => true,
      nextState: SwapState.CANCELLED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_CANCELLED",
          title: "Swap cancelled",
          body: "The swap was cancelled because a shift was edited.",
          data: {},
        },
        {
          target: "receiver",
          type: "SWAP_CANCELLED",
          title: "Swap cancelled",
          body: "The swap was cancelled because a shift was edited.",
          data: {},
        },
      ],
    },
    [SwapEvent.REQUEST_MANAGER_APPROVAL]: {
      guard: (ctx) => ctx.requiresManagerApproval && guardActorIsReceiver(ctx),
      nextState: SwapState.PENDING_MANAGER,
      notifications: (ctx) => [
        {
          target: "manager",
          type: "SWAP_PENDING_APPROVAL",
          title: "Swap pending approval",
          body: "A swap has been agreed and requires your approval.",
          data: { initiatorId: ctx.initiatorId, receiverId: ctx.receiverId },
        },
        {
          target: "initiator",
          type: "SWAP_PENDING_APPROVAL",
          title: "Swap accepted",
          body: "Your swap has been accepted and is waiting for manager approval.",
          data: { receiverId: ctx.receiverId },
        },
        {
          target: "receiver",
          type: "SWAP_PENDING_APPROVAL",
          title: "Swap pending approval",
          body: "Your swap is waiting for manager approval.",
          data: { initiatorId: ctx.initiatorId },
        },
      ],
    },
    [SwapEvent.CONFIRM]: {
      guard: (ctx) =>
        !ctx.requiresManagerApproval && guardActorIsReceiver(ctx),
      nextState: SwapState.APPROVED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_APPROVED",
          title: "Swap completed",
          body: "The swap has been completed.",
          data: {},
        },
        {
          target: "receiver",
          type: "SWAP_APPROVED",
          title: "Swap completed",
          body: "The swap has been completed.",
          data: {},
        },
      ],
    },
    [SwapEvent.CANCEL]: {
      guard: (ctx) => guardActorIsInitiator(ctx) || guardActorIsReceiver(ctx),
      nextState: SwapState.CANCELLED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_CANCELLED",
          title: "Swap cancelled",
          body: "The swap was cancelled.",
          data: { actorId: ctx.actorId },
        },
        {
          target: "receiver",
          type: "SWAP_CANCELLED",
          title: "Swap cancelled",
          body: "The swap was cancelled.",
          data: { actorId: ctx.actorId },
        },
      ],
    },
  },

  [SwapState.PENDING_MANAGER]: {
    [SwapEvent.SHIFT_EDITED]: {
      guard: () => true,
      nextState: SwapState.CANCELLED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_CANCELLED",
          title: "Swap cancelled",
          body: "The swap was cancelled because a shift was edited.",
          data: {},
        },
        {
          target: "receiver",
          type: "SWAP_CANCELLED",
          title: "Swap cancelled",
          body: "The swap was cancelled because a shift was edited.",
          data: {},
        },
      ],
    },
    [SwapEvent.MANAGER_APPROVE]: {
      guard: (ctx) => guardActorIsManager(ctx),
      nextState: SwapState.APPROVED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_APPROVED",
          title: "Swap approved",
          body: "Your swap has been approved by a manager.",
          data: {},
        },
        {
          target: "receiver",
          type: "SWAP_APPROVED",
          title: "Swap approved",
          body: "The swap has been approved by a manager.",
          data: {},
        },
      ],
    },
    [SwapEvent.MANAGER_REJECT]: {
      guard: (ctx) => guardActorIsManager(ctx),
      nextState: SwapState.CANCELLED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_REJECTED",
          title: "Swap rejected by manager",
          body: "A manager declined the swap request.",
          data: {},
        },
        {
          target: "receiver",
          type: "SWAP_REJECTED",
          title: "Swap rejected by manager",
          body: "A manager declined the swap request.",
          data: {},
        },
      ],
    },
    [SwapEvent.CANCEL]: {
      guard: (ctx) => guardActorIsInitiator(ctx) || guardActorIsReceiver(ctx),
      nextState: SwapState.CANCELLED,
      notifications: (ctx) => [
        {
          target: "initiator",
          type: "SWAP_CANCELLED",
          title: "Swap cancelled",
          body: "The swap was cancelled before manager approval.",
          data: { actorId: ctx.actorId },
        },
        {
          target: "receiver",
          type: "SWAP_CANCELLED",
          title: "Swap cancelled",
          body: "The swap was cancelled before manager approval.",
          data: { actorId: ctx.actorId },
        },
      ],
    },
  },

  [SwapState.APPROVED]: {},
  [SwapState.CANCELLED]: {},
  [SwapState.EXPIRED]: {},
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Attempt a state transition. Pure function - no side effects.
 */
export function transition(
  currentState: SwapStateType,
  event: SwapEventType,
  context: SwapContext
): TransitionResult {
  const handlers = TRANSITIONS[currentState];
  const handler = handlers?.[event];

  if (!handler) {
    return {
      success: false,
      error: `Transition not allowed: ${currentState} --[${event}]-->`,
      notifications: [],
    };
  }

  if (!handler.guard(context)) {
    return {
      success: false,
      error: `Guard failed for transition: ${currentState} --[${event}]-->`,
      notifications: [],
    };
  }

  const result: TransitionResult = {
    success: true,
    newState: handler.nextState,
    notifications: handler.notifications(context),
  };
  if (event === SwapEvent.REJECT || event === SwapEvent.MANAGER_REJECT) {
    result.prismaStatusOverride = "REJECTED";
  }
  return result;
}

/**
 * Get all valid events from a given state.
 */
export function getValidEvents(
  state: SwapStateType,
  context: SwapContext
): SwapEventType[] {
  const handlers = TRANSITIONS[state];
  if (!handlers) return [];

  return (Object.keys(handlers) as SwapEventType[]).filter((event) => {
    const handler = handlers[event];
    return handler?.guard(context) ?? false;
  });
}

/**
 * Map workflow state to Prisma SwapRequestStatus.
 */
export function toPrismaStatus(
  state: SwapStateType
): "PENDING" | "PENDING_MANAGER" | "APPROVED" | "REJECTED" | "CANCELLED" {
  switch (state) {
    case SwapState.APPROVED:
      return "APPROVED";
    case SwapState.PENDING_MANAGER:
      return "PENDING_MANAGER";
    case SwapState.CANCELLED:
    case SwapState.EXPIRED:
      return "CANCELLED";
    case SwapState.REQUESTED:
    case SwapState.ACCEPTED:
    case SwapState.ACTIVE:
    default:
      return "PENDING";
  }
}

/**
 * Map Prisma status to workflow state (for loading existing requests).
 */
export function fromPrismaStatus(
  status: "PENDING" | "PENDING_MANAGER" | "APPROVED" | "REJECTED" | "CANCELLED",
  _requiresManagerApproval?: boolean
): SwapStateType {
  switch (status) {
    case "APPROVED":
      return SwapState.APPROVED;
    case "PENDING_MANAGER":
      return SwapState.PENDING_MANAGER;
    case "REJECTED":
    case "CANCELLED":
      return SwapState.CANCELLED;
    case "PENDING":
    default:
      return SwapState.REQUESTED;
  }
}
