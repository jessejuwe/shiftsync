"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, X, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getQueryClient } from "@/app/get-query-client";

interface SwapRequestItem {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  initiator: { id: string; name: string; email: string };
  receiver: { id: string; name: string; email: string };
  initiatorShift: {
    shift: {
      startsAt: string;
      endsAt: string;
      location: { name: string };
    };
  };
}

interface ManagerSwapApprovalsPanelProps {
  currentUserId: string;
}

export function ManagerSwapApprovalsPanel({
  currentUserId,
}: ManagerSwapApprovalsPanelProps) {
  const queryClient = getQueryClient();
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingOverrideSwap, setPendingOverrideSwap] = useState<{
    swapRequestId: string;
    actorId: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["swap-requests", "pending_approval"],
    queryFn: async () => {
      const res = await fetch("/api/swap-requests?role=pending_approval");
      if (!res.ok) throw new Error("Failed to fetch pending swaps");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      swapRequestId,
      actorId,
      overrideReason: reason,
    }: {
      swapRequestId: string;
      actorId: string;
      overrideReason?: string;
    }) => {
      const res = await fetch("/api/swaps/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swapRequestId,
          actorId,
          ...(reason && { overrideReason: reason }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.message ?? "Failed to approve") as Error & {
          status?: number;
          details?: {
            blocks?: Array<{
              type: string;
              message: string;
              code?: string;
              metadata?: { requiresOverride?: boolean };
            }>;
          };
        };
        (err as Error & { status?: number }).status = res.status;
        err.details = { blocks: json.details };
        throw err;
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.refetchQueries({ queryKey: ["shifts"] });
      setOverrideDialogOpen(false);
      setPendingOverrideSwap(null);
      setOverrideReason("");
      toast.success("Swap approved");
    },
    onError: (err, variables) => {
      const error = err as Error & {
        status?: number;
        details?: {
          blocks?: Array<{
            type: string;
            message: string;
            code?: string;
            metadata?: { requiresOverride?: boolean };
          }>;
        };
      };
      const block = error.details?.blocks?.[0];
      const needsOverride =
        error.status === 422 &&
        block?.code === "CONSECUTIVE_DAYS_EXCEEDED" &&
        block.metadata?.requiresOverride === true;

      if (needsOverride && variables) {
        setPendingOverrideSwap({
          swapRequestId: variables.swapRequestId,
          actorId: variables.actorId,
        });
        setOverrideReason("");
        setOverrideDialogOpen(true);
      } else {
        const blocks = error.details?.blocks;
        const description = blocks?.length
          ? blocks.map((b) => b.message).join("\n")
          : undefined;
        toast.error(error.message, description ? { description } : undefined);
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      swapRequestId,
      actorId,
    }: {
      swapRequestId: string;
      actorId: string;
    }) => {
      const res = await fetch("/api/swaps/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swapRequestId, actorId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to reject");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      toast.success("Swap rejected");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    },
  });

  const swapRequests: SwapRequestItem[] = data?.swapRequests ?? [];
  const pendingCount = swapRequests.length;

  const handleOverrideSubmit = () => {
    if (pendingOverrideSwap && overrideReason.trim()) {
      approveMutation.mutate({
        ...pendingOverrideSwap,
        overrideReason: overrideReason.trim(),
      });
    }
  };

  if (isLoading || pendingCount === 0) {
    return null;
  }

  return (
    <Collapsible defaultOpen>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="size-4" />
                Pending swap approvals
                <Badge variant="default" className="ml-1">
                  {pendingCount}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {swapRequests.map((sr) => (
              <div
                key={sr.id}
                className="rounded-lg border p-4 space-y-2"
              >
                <p className="text-sm font-medium">
                  {sr.initiator.name} ↔ {sr.receiver.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {sr.initiatorShift.shift.location.name} –{" "}
                  {format(
                    new Date(sr.initiatorShift.shift.startsAt),
                    "MMM d, HH:mm"
                  )}{" "}
                  – {format(new Date(sr.initiatorShift.shift.endsAt), "HH:mm")}
                </p>
                {sr.message && (
                  <p className="text-muted-foreground text-sm italic">
                    &ldquo;{sr.message}&rdquo;
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      approveMutation.mutate({
                        swapRequestId: sr.id,
                        actorId: currentUserId,
                      })
                    }
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <Check className="size-3.5 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      rejectMutation.mutate({
                        swapRequestId: sr.id,
                        actorId: currentUserId,
                      })
                    }
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <X className="size-3.5 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>

      <AlertDialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>7th consecutive day</AlertDialogTitle>
            <AlertDialogDescription>
              This swap would assign the receiver to their 7th consecutive
              working day. A reason is required to override. The override will
              be stored in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="override-reason">Reason for override</Label>
            <Input
              id="override-reason"
              placeholder="e.g. Staff requested, coverage needed"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingOverrideSwap(null);
                setOverrideReason("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOverrideSubmit}
              disabled={!overrideReason.trim() || approveMutation.isPending}
            >
              Approve with override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
