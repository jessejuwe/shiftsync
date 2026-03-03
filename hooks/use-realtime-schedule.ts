"use client";

import { useEffect, useRef, useCallback } from "react";
import Pusher, { type Channel } from "pusher-js";
import {
  CHANNELS,
  PUSHER_EVENTS,
  type SchedulePublishedPayload,
  type ScheduleUnpublishedPayload,
  type ShiftAssignedPayload,
  type ShiftUnassignedPayload,
  type ShiftEditedPayload,
  type SwapRequestedPayload,
  type SwapApprovedPayload,
  type AssignmentConflictPayload,
  type ClockInOutPayload,
} from "@/lib/pusher-events";

// =============================================================================
// TYPES
// =============================================================================

export interface RealtimeScheduleCallbacks {
  onSchedulePublished?: (payload: SchedulePublishedPayload) => void;
  onScheduleUnpublished?: (payload: ScheduleUnpublishedPayload) => void;
  onShiftAssigned?: (payload: ShiftAssignedPayload) => void;
  onShiftUnassigned?: (payload: ShiftUnassignedPayload) => void;
  onShiftEdited?: (payload: ShiftEditedPayload) => void;
  onSwapRequested?: (payload: SwapRequestedPayload) => void;
  onSwapApproved?: (payload: SwapApprovedPayload) => void;
  onAssignmentConflict?: (payload: AssignmentConflictPayload) => void;
  onClockIn?: (payload: ClockInOutPayload) => void;
  onClockOut?: (payload: ClockInOutPayload) => void;
}

export interface UseRealtimeScheduleOptions {
  locationId?: string;
  locationIds?: string[];
  userId?: string;
  authEndpoint?: string;
  callbacks?: RealtimeScheduleCallbacks;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Subscribe to real-time schedule events via Pusher.
 * - private-schedule-${locationId}: schedule published, shift assigned, shift edited (auth required)
 * - private-user-${userId}: swap requested, swap approved, assignment conflict
 */
export function useRealtimeSchedule({
  locationId,
  locationIds,
  userId,
  authEndpoint = "/api/pusher/auth",
  callbacks = {},
}: UseRealtimeScheduleOptions) {
  const pusherRef = useRef<Pusher | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const ids = locationIds ?? (locationId ? [locationId] : []);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us2";

    if (!key || ids.length === 0) {
      return;
    }

    const pusherConfig: {
      cluster: string;
      authEndpoint: string;
      auth?: { headers: Record<string, string> };
    } = {
      cluster,
      authEndpoint,
    };
    if (userId) {
      pusherConfig.auth = {
        headers: {
          "X-User-Id": userId,
          Authorization: `Bearer ${userId}`,
        },
      };
    }
    const pusher = new Pusher(key, pusherConfig);

    pusherRef.current = pusher;

    for (const locId of ids) {
      const ch = pusher.subscribe(CHANNELS.schedule(locId));
      ch.bind(
        PUSHER_EVENTS.SCHEDULE_PUBLISHED,
        (payload: SchedulePublishedPayload) => {
          callbacksRef.current.onSchedulePublished?.(payload);
        },
      );
      ch.bind(
        PUSHER_EVENTS.SCHEDULE_UNPUBLISHED,
        (payload: ScheduleUnpublishedPayload) => {
          callbacksRef.current.onScheduleUnpublished?.(payload);
        },
      );
      ch.bind(PUSHER_EVENTS.SHIFT_ASSIGNED, (payload: ShiftAssignedPayload) => {
        callbacksRef.current.onShiftAssigned?.(payload);
      });
      ch.bind(
        PUSHER_EVENTS.SHIFT_UNASSIGNED,
        (payload: ShiftUnassignedPayload) => {
          callbacksRef.current.onShiftUnassigned?.(payload);
        },
      );
      ch.bind(PUSHER_EVENTS.SHIFT_EDITED, (payload: ShiftEditedPayload) => {
        callbacksRef.current.onShiftEdited?.(payload);
      });
      ch.bind(PUSHER_EVENTS.CLOCK_IN, (payload: ClockInOutPayload) => {
        callbacksRef.current.onClockIn?.(payload);
      });
      ch.bind(PUSHER_EVENTS.CLOCK_OUT, (payload: ClockInOutPayload) => {
        callbacksRef.current.onClockOut?.(payload);
      });
    }

    let userChannel: Channel | null = null;
    if (userId) {
      userChannel = pusher.subscribe(CHANNELS.user(userId));
      userChannel.bind(
        PUSHER_EVENTS.SWAP_REQUESTED,
        (payload: SwapRequestedPayload) => {
          callbacksRef.current.onSwapRequested?.(payload);
        },
      );
      userChannel.bind(
        PUSHER_EVENTS.SWAP_APPROVED,
        (payload: SwapApprovedPayload) => {
          callbacksRef.current.onSwapApproved?.(payload);
        },
      );
      userChannel.bind(
        PUSHER_EVENTS.ASSIGNMENT_CONFLICT,
        (payload: AssignmentConflictPayload) => {
          callbacksRef.current.onAssignmentConflict?.(payload);
        },
      );
    }

    return () => {
      for (const locId of ids) {
        pusher.channel(CHANNELS.schedule(locId))?.unbind_all();
        pusher.unsubscribe(CHANNELS.schedule(locId));
      }
      if (userChannel && userId) {
        userChannel.unbind_all();
        pusher.unsubscribe(CHANNELS.user(userId));
      }
      pusher.disconnect();
      pusherRef.current = null;
    };
  }, [ids.join(","), userId, authEndpoint]);

  const isConnected = useCallback(() => {
    return pusherRef.current?.connection.state === "connected";
  }, []);

  return { isConnected };
}
