"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: unknown;
  readAt: string | null;
  createdAt: string;
}

export function NotificationCenter() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications: Notification[] = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "Notifications"}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-[min(20rem,calc(100vw-2rem))] p-0"
        align="end"
        side="bottom"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="size-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[320px]">
          {isLoading ? (
            <p className="text-muted-foreground p-4 text-center text-sm">
              Loading...
            </p>
          ) : notifications.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-sm">
              No notifications
            </p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.readAt && markReadMutation.mutate(n.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    !n.readAt && "bg-muted/30"
                  )}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && (
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                      {n.body}
                    </p>
                  )}
                  <p className="text-muted-foreground mt-1 text-[10px]">
                    {formatDistanceToNow(new Date(n.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
