/**
 * Pusher event broadcasting utility.
 * Emits real-time events for schedule, swap, and assignment changes.
 */

import { getPusherServer } from "./pusher";

// =============================================================================
// CHANNELS
// =============================================================================

export const CHANNELS = {
  schedule: (locationId: string) => `schedule-${locationId}`,
  user: (userId: string) => `private-user-${userId}`,
} as const;

// =============================================================================
// EVENT TYPES
// =============================================================================

export const PUSHER_EVENTS = {
  SCHEDULE_PUBLISHED: "schedule-published",
  SHIFT_ASSIGNED: "shift-assigned",
  SHIFT_UNASSIGNED: "shift-unassigned",
  SHIFT_EDITED: "shift-edited",
  SWAP_REQUESTED: "swap-requested",
  SWAP_APPROVED: "swap-approved",
  ASSIGNMENT_CONFLICT: "assignment-conflict",
} as const;

export type PusherEventType = (typeof PUSHER_EVENTS)[keyof typeof PUSHER_EVENTS];

// =============================================================================
// EVENT PAYLOADS
// =============================================================================

export interface SchedulePublishedPayload {
  locationId: string;
  publishedAt: string; // ISO
  shiftIds?: string[];
}

export interface SwapRequestedPayload {
  swapRequestId: string;
  initiatorId: string;
  receiverId: string;
  initiatorShiftId: string;
  receiverShiftId?: string;
}

export interface SwapApprovedPayload {
  swapRequestId: string;
  initiatorId: string;
  receiverId: string;
}

export interface AssignmentConflictPayload {
  shiftId: string;
  userId: string;
  conflictType: "double-booking" | "rest-period" | "overtime";
  message?: string;
}

export interface ShiftAssignedPayload {
  assignmentId: string;
  shiftId: string;
  userId: string;
  locationId: string;
}

export interface ShiftEditedPayload {
  shiftId: string;
  locationId: string;
  updatedAt: string; // ISO
}

export interface ShiftUnassignedPayload {
  assignmentId: string;
  shiftId: string;
  userId: string;
  locationId: string;
}

// =============================================================================
// BROADCAST HELPERS
// =============================================================================

function getPusherSafe() {
  try {
    return getPusherServer();
  } catch {
    return null;
  }
}

/**
 * Emit when a schedule is published for a location.
 */
export async function broadcastSchedulePublished(
  locationId: string,
  payload: Omit<SchedulePublishedPayload, "locationId">
): Promise<void> {
  const pusher = getPusherSafe();
  if (!pusher) return;

  await pusher.trigger(CHANNELS.schedule(locationId), PUSHER_EVENTS.SCHEDULE_PUBLISHED, {
    ...payload,
    locationId,
  } as SchedulePublishedPayload);
}

/**
 * Emit when a shift is assigned to a user.
 * Broadcasts to user channel (assigned user) and schedule channel (location).
 */
export async function broadcastShiftAssigned(
  userId: string,
  locationId: string,
  payload: Omit<ShiftAssignedPayload, "userId" | "locationId">
): Promise<void> {
  const pusher = getPusherSafe();
  if (!pusher) return;

  const fullPayload: ShiftAssignedPayload = {
    ...payload,
    userId,
    locationId,
  };

  await Promise.all([
    pusher.trigger(CHANNELS.user(userId), PUSHER_EVENTS.SHIFT_ASSIGNED, fullPayload),
    pusher.trigger(CHANNELS.schedule(locationId), PUSHER_EVENTS.SHIFT_ASSIGNED, fullPayload),
  ]);
}

/**
 * Emit when a staff member is unassigned from a shift.
 */
export async function broadcastShiftUnassigned(
  userId: string,
  locationId: string,
  payload: ShiftUnassignedPayload
): Promise<void> {
  const pusher = getPusherSafe();
  if (!pusher) return;

  await Promise.all([
    pusher.trigger(CHANNELS.user(userId), PUSHER_EVENTS.SHIFT_UNASSIGNED, payload),
    pusher.trigger(CHANNELS.schedule(locationId), PUSHER_EVENTS.SHIFT_UNASSIGNED, payload),
  ]);
}

/**
 * Emit when a shift is edited.
 */
export async function broadcastShiftEdited(
  locationId: string,
  payload: ShiftEditedPayload
): Promise<void> {
  const pusher = getPusherSafe();
  if (!pusher) return;

  await pusher.trigger(CHANNELS.schedule(locationId), PUSHER_EVENTS.SHIFT_EDITED, payload);
}

/**
 * Emit when a swap request is sent to a receiver.
 */
export async function broadcastSwapRequested(
  receiverId: string,
  payload: SwapRequestedPayload
): Promise<void> {
  const pusher = getPusherSafe();
  if (!pusher) return;

  await pusher.trigger(CHANNELS.user(receiverId), PUSHER_EVENTS.SWAP_REQUESTED, payload);
}

/**
 * Emit when a swap is approved (to both initiator and receiver).
 */
export async function broadcastSwapApproved(
  initiatorId: string,
  receiverId: string,
  payload: SwapApprovedPayload
): Promise<void> {
  const pusher = getPusherSafe();
  if (!pusher) return;

  await Promise.all([
    pusher.trigger(CHANNELS.user(initiatorId), PUSHER_EVENTS.SWAP_APPROVED, payload),
    pusher.trigger(CHANNELS.user(receiverId), PUSHER_EVENTS.SWAP_APPROVED, payload),
  ]);
}

/**
 * Emit when a shift assignment conflict is detected.
 */
export async function broadcastAssignmentConflict(
  userId: string,
  payload: AssignmentConflictPayload
): Promise<void> {
  const pusher = getPusherSafe();
  if (!pusher) return;

  await pusher.trigger(CHANNELS.user(userId), PUSHER_EVENTS.ASSIGNMENT_CONFLICT, payload);
}
