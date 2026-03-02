"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeftRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getQueryClient } from "@/app/get-query-client";
import { cn } from "@/lib/utils";

const SWAP_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending",
    className:
      "border-amber-500/50 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500/30",
  },
  PENDING_MANAGER: {
    label: "Pending Manager",
    className:
      "border-blue-500/50 bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-500/30",
  },
  APPROVED: {
    label: "Approved",
    className:
      "border-green-500/50 bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200 dark:border-green-500/30",
  },
  REJECTED: {
    label: "Declined",
    className:
      "border-red-500/50 bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200 dark:border-red-500/30",
  },
  CANCELLED: {
    label: "Cancelled",
    className:
      "border-muted bg-muted text-muted-foreground",
  },
};

interface SwapRequestItem {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  initiatorId: string;
  initiator: { id: string; name: string; email: string };
  receiverId: string;
  receiver: { id: string; name: string; email: string };
  initiatorShiftId: string;
  receiverShiftId: string | null;
  initiatorShift: {
    id: string;
    shiftId: string;
    shift: {
      id: string;
      startsAt: string;
      endsAt: string;
      location: { id: string; name: string; timezone: string };
    };
    user: { id: string; name: string };
  };
}

interface SwapRequestsPanelProps {
  currentUserId: string;
}

export function SwapRequestsPanel({ currentUserId }: SwapRequestsPanelProps) {
  const queryClient = getQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["swap-requests", "receiver"],
    queryFn: async () => {
      const res = await fetch("/api/swap-requests?role=receiver");
      if (!res.ok) throw new Error("Failed to fetch swap requests");
      return res.json();
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({
      swapRequestId,
      action,
    }: {
      swapRequestId: string;
      action: "accept" | "reject";
    }) => {
      const res = await fetch(
        `/api/swap-requests/${swapRequestId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            actorId: currentUserId,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? `Failed to ${action} swap`);
      }
      return json;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success(
        action === "accept"
          ? "Swap accepted"
          : "Swap request declined"
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Action failed");
    },
  });

  const swapRequests: SwapRequestItem[] = data?.swapRequests ?? [];
  const pendingIncoming = swapRequests.filter(
    (sr) => sr.status === "PENDING" && sr.receiverId === currentUserId
  );
  const hasPending = pendingIncoming.length > 0;

  if (isLoading || swapRequests.length === 0) {
    return null;
  }

  return (
    <Collapsible defaultOpen={hasPending}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="size-4" />
                Swap requests
                {hasPending && (
                  <Badge variant="default" className="ml-1">
                    {pendingIncoming.length}
                  </Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {swapRequests.map((sr) => {
              const isReceiver = sr.receiverId === currentUserId;
              const isPending = sr.status === "PENDING";
              const canRespond = isReceiver && isPending;

              return (
                <div
                  key={sr.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {isReceiver
                          ? `${sr.initiator.name} wants to swap`
                          : `You requested swap with ${sr.receiver.name}`}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {sr.initiatorShift.shift.location.name} –{" "}
                        {format(
                          new Date(sr.initiatorShift.shift.startsAt),
                          "MMM d, HH:mm"
                        )}{" "}
                        –{" "}
                        {format(
                          new Date(sr.initiatorShift.shift.endsAt),
                          "HH:mm"
                        )}
                      </p>
                      {sr.receiverShiftId && (
                        <p className="text-muted-foreground text-xs mt-0.5">
                          Direct swap (their shift for yours)
                        </p>
                      )}
                      {sr.message && (
                        <p className="text-muted-foreground text-sm mt-1 italic">
                          &ldquo;{sr.message}&rdquo;
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        SWAP_STATUS_CONFIG[sr.status]?.className ??
                          "border-border"
                      )}
                    >
                      {SWAP_STATUS_CONFIG[sr.status]?.label ?? sr.status}
                    </Badge>
                  </div>
                  {canRespond && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          respondMutation.mutate({
                            swapRequestId: sr.id,
                            action: "accept",
                          })
                        }
                        disabled={respondMutation.isPending}
                      >
                        <Check className="size-3.5 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          respondMutation.mutate({
                            swapRequestId: sr.id,
                            action: "reject",
                          })
                        }
                        disabled={respondMutation.isPending}
                      >
                        <X className="size-3.5 mr-1" />
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
