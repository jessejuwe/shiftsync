"use client";

import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { getQueryClient } from "@/app/get-query-client";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";

/**
 * Subscribes to Pusher user channel and invalidates notifications + shows toasts
 * when shift assigned, swap requested/approved, skill added/removed, etc.
 */
export function RealtimeNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const queryClient = getQueryClient();
  const userId = session?.user?.id;

  const invalidateNotifications = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  useRealtimeNotifications({
    userId: userId ?? "",
    callbacks: {
      onShiftAssigned: () => {
        invalidateNotifications();
        toast.info("New shift assigned", {
          description: "You have been assigned to a shift.",
        });
      },
      onSwapRequested: () => {
        invalidateNotifications();
        toast.info("Swap request", {
          description: "Someone has requested a shift swap with you.",
        });
      },
      onSwapApproved: () => {
        invalidateNotifications();
        toast.success("Swap approved", {
          description: "Your shift swap has been approved.",
        });
      },
      onAssignmentConflict: (payload) => {
        invalidateNotifications();
        toast.error("Assignment conflict", {
          description:
            payload.message ?? "Another manager assigned this staff member.",
        });
      },
      onNotificationCreated: (payload) => {
        invalidateNotifications();
        if (
          payload.notificationType === "SKILL_ADDED" ||
          payload.notificationType === "SKILL_REMOVED"
        ) {
          void queryClient.invalidateQueries({
            queryKey: ["settings", "my-skills"],
          });
        }
        toast.info(payload.title ?? "New notification", {
          description: "Check your notifications for details.",
        });
      },
    },
  });

  return <>{children}</>;
}
