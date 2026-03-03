"use client";

import { useEffect, useRef, useCallback } from "react";
import Pusher from "pusher-js";
import {
  CHANNELS,
  PUSHER_EVENTS,
  type ShiftAssignedPayload,
  type SwapRequestedPayload,
  type SwapApprovedPayload,
  type AssignmentConflictPayload,
  type NotificationCreatedPayload,
} from "@/lib/pusher-events";

// =============================================================================
// TYPES
// =============================================================================

export interface RealtimeNotificationCallbacks {
  onShiftAssigned?: (payload: ShiftAssignedPayload) => void;
  onSwapRequested?: (payload: SwapRequestedPayload) => void;
  onSwapApproved?: (payload: SwapApprovedPayload) => void;
  onAssignmentConflict?: (payload: AssignmentConflictPayload) => void;
  onNotificationCreated?: (payload: NotificationCreatedPayload) => void;
}

export interface UseRealtimeNotificationsOptions {
  userId: string;
  authEndpoint?: string;
  callbacks?: RealtimeNotificationCallbacks;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Subscribe to real-time notification events via Pusher.
 * Subscribes to private-user-${userId} for:
 * - shift-assigned
 * - swap-requested
 * - swap-approved
 * - assignment-conflict
 *
 * Use callbacks to show toasts, update badge counts, etc.
 */
export function useRealtimeNotifications({
  userId,
  authEndpoint = "/api/pusher/auth",
  callbacks = {},
}: UseRealtimeNotificationsOptions) {
  const pusherRef = useRef<Pusher | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us2";

    if (!key || !userId) {
      return;
    }

    const pusher = new Pusher(key, {
      cluster,
      authEndpoint,
      auth: {
        headers: {
          "X-User-Id": userId,
          Authorization: `Bearer ${userId}`,
        },
      },
    });

    pusherRef.current = pusher;

    const userChannel = pusher.subscribe(CHANNELS.user(userId));

    userChannel.bind(
      PUSHER_EVENTS.SHIFT_ASSIGNED,
      (payload: ShiftAssignedPayload) => {
        callbacksRef.current.onShiftAssigned?.(payload);
      }
    );

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

    userChannel.bind(
      PUSHER_EVENTS.NOTIFICATION_CREATED,
      (payload: NotificationCreatedPayload) => {
        callbacksRef.current.onNotificationCreated?.(payload);
      }
    );

    return () => {
      userChannel.unbind_all();
      pusher.unsubscribe(CHANNELS.user(userId));
      pusher.disconnect();
      pusherRef.current = null;
    };
  }, [userId, authEndpoint]);

  const isConnected = useCallback(() => {
    return pusherRef.current?.connection.state === "connected";
  }, []);

  return { isConnected };
}
