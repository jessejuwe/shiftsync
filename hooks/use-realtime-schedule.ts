"use client";

import { useEffect, useRef, useCallback } from "react";
import Pusher, { type Channel } from "pusher-js";
import {
  CHANNELS,
  PUSHER_EVENTS,
  type SchedulePublishedPayload,
  type ShiftAssignedPayload,
  type ShiftEditedPayload,
  type SwapRequestedPayload,
  type SwapApprovedPayload,
  type AssignmentConflictPayload,
} from "@/lib/pusher-events";

// =============================================================================
// TYPES
// =============================================================================

export interface RealtimeScheduleCallbacks {
  onSchedulePublished?: (payload: SchedulePublishedPayload) => void;
  onShiftAssigned?: (payload: ShiftAssignedPayload) => void;
  onShiftEdited?: (payload: ShiftEditedPayload) => void;
  onSwapRequested?: (payload: SwapRequestedPayload) => void;
  onSwapApproved?: (payload: SwapApprovedPayload) => void;
  onAssignmentConflict?: (payload: AssignmentConflictPayload) => void;
}

export interface UseRealtimeScheduleOptions {
  locationId: string;
  userId?: string;
  authEndpoint?: string;
  callbacks?: RealtimeScheduleCallbacks;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Subscribe to real-time schedule events via Pusher.
 * - schedule-${locationId}: schedule published, shift assigned, shift edited
 * - private-user-${userId}: swap requested, swap approved, assignment conflict
 */
export function useRealtimeSchedule({
  locationId,
  userId,
  authEndpoint = "/api/pusher/auth",
  callbacks = {},
}: UseRealtimeScheduleOptions) {
  const pusherRef = useRef<Pusher | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us2";

    if (!key) {
      return;
    }

    const pusher = new Pusher(key, {
      cluster,
      authEndpoint,
      auth: userId
        ? {
            headers: {
              "X-User-Id": userId,
              Authorization: `Bearer ${userId}`,
            },
          }
        : undefined,
    });

    pusherRef.current = pusher;

    // Subscribe to schedule channel (public)
    const scheduleChannel = pusher.subscribe(CHANNELS.schedule(locationId));

    scheduleChannel.bind(
      PUSHER_EVENTS.SCHEDULE_PUBLISHED,
      (payload: SchedulePublishedPayload) => {
        callbacksRef.current.onSchedulePublished?.(payload);
      }
    );

    scheduleChannel.bind(
      PUSHER_EVENTS.SHIFT_ASSIGNED,
      (payload: ShiftAssignedPayload) => {
        callbacksRef.current.onShiftAssigned?.(payload);
      }
    );

    scheduleChannel.bind(
      PUSHER_EVENTS.SHIFT_EDITED,
      (payload: ShiftEditedPayload) => {
        callbacksRef.current.onShiftEdited?.(payload);
      }
    );

    // Subscribe to user channel (private) if userId provided
    let userChannel: Channel | null = null;
    if (userId) {
      userChannel = pusher.subscribe(CHANNELS.user(userId));

      userChannel.bind(
        PUSHER_EVENTS.SWAP_REQUESTED,
        (payload: SwapRequestedPayload) => {
          callbacksRef.current.onSwapRequested?.(payload);
        }
      );

      userChannel.bind(
        PUSHER_EVENTS.SWAP_APPROVED,
        (payload: SwapApprovedPayload) => {
          callbacksRef.current.onSwapApproved?.(payload);
        }
      );

      userChannel.bind(
        PUSHER_EVENTS.ASSIGNMENT_CONFLICT,
        (payload: AssignmentConflictPayload) => {
          callbacksRef.current.onAssignmentConflict?.(payload);
        }
      );
    }

    return () => {
      scheduleChannel.unbind_all();
      pusher.unsubscribe(CHANNELS.schedule(locationId));

      if (userChannel && userId) {
        userChannel.unbind_all();
        pusher.unsubscribe(CHANNELS.user(userId));
      }

      pusher.disconnect();
      pusherRef.current = null;
    };
  }, [locationId, userId, authEndpoint]);

  const isConnected = useCallback(() => {
    return pusherRef.current?.connection.state === "connected";
  }, []);

  return { isConnected };
}
