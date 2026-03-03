"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ValidationDisplay } from "./validation-display";
import type { ValidationResult } from "./validation-display";

interface AssignPreview {
  message: string | null;
  projectedHours: number;
  overtimeHours: number;
  isOverWarning: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: { id: string; name: string }[];
  certifications: {
    id: string;
    locationId: string;
    locationName: string;
    expiresAt: string;
  }[];
}

interface StaffSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string | null;
  shiftLocationId: string | null;
  requiredSkillIds: string[];
  requiredSkills: { id: string; name: string }[];
  onAssignSuccess: () => void;
  onAssignError?: (error: unknown) => void;
}

export function StaffSelectModal({
  open,
  onOpenChange,
  shiftId,
  shiftLocationId,
  requiredSkillIds,
  requiredSkills,
  onAssignSuccess,
  onAssignError,
}: StaffSelectModalProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAssign, setPendingAssign] = useState<{
    userId: string;
    preview: AssignPreview;
  } | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingOverrideUserId, setPendingOverrideUserId] = useState<
    string | null
  >(null);

  const { data: staffData, isLoading } = useQuery({
    queryKey: ["staff", shiftId, shiftLocationId],
    queryFn: async () => {
      if (shiftId) {
        const res = await fetch(`/api/shifts/${shiftId}/qualified-staff`);
        if (!res.ok) throw new Error("Failed to fetch qualified staff");
        return res.json();
      }
      const params = new URLSearchParams();
      if (shiftLocationId) params.set("locationId", shiftLocationId);
      const res = await fetch("/api/staff?" + params);
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
    enabled: open && (!!shiftId || !!shiftLocationId),
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      userId,
      overrideReason: reason,
    }: {
      userId: string;
      overrideReason?: string;
    }) => {
      if (!shiftId) throw new Error("No shift selected");
      const res = await fetch("/api/shifts/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId,
          userId,
          ...(reason && { overrideReason: reason }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message ?? "Assignment failed") as Error & {
          status?: number;
          details?: {
            blocks?: ValidationResult[];
            warnings?: ValidationResult[];
          };
          userId?: string;
        };
        err.status = res.status;
        err.details = data.details;
        err.userId = userId;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setOverrideDialogOpen(false);
      setPendingOverrideUserId(null);
      toast.success("Staff assigned successfully");
      onAssignSuccess();
      onOpenChange(false);
    },
    onError: (err) => {
      const e = err as Error & {
        status?: number;
        details?: {
          blocks?: Array<
            ValidationResult & { metadata?: { requiresOverride?: boolean } }
          >;
        };
        userId?: string;
      };
      const block = e.details?.blocks?.[0];
      const needsOverride =
        e.status === 422 &&
        block?.code === "CONSECUTIVE_DAYS_EXCEEDED" &&
        block?.metadata?.requiresOverride === true &&
        e.userId;
      if (needsOverride) {
        setPendingOverrideUserId(e.userId!);
        setOverrideReason("");
        setOverrideDialogOpen(true);
      } else {
        toast.error(err instanceof Error ? err.message : "Assignment failed");
      }
      onAssignError?.(err);
    },
  });

  const handleAssignClick = async (userId: string) => {
    if (!shiftId) return;
    try {
      const res = await fetch(
        `/api/shifts/assign/preview?shiftId=${encodeURIComponent(shiftId)}&userId=${encodeURIComponent(userId)}`,
      );
      const data = await res.json();
      const preview: AssignPreview = {
        message: data.message ?? null,
        projectedHours: data.projectedHours ?? 0,
        overtimeHours: data.overtimeHours ?? 0,
        isOverWarning: data.isOverWarning ?? false,
      };
      if (preview.message && preview.isOverWarning) {
        setPendingAssign({ userId, preview });
        setConfirmOpen(true);
      } else {
        assignMutation.mutate({ userId });
      }
    } catch {
      assignMutation.mutate({ userId });
    }
  };

  const handleConfirmAssign = () => {
    if (pendingAssign) {
      assignMutation.mutate({ userId: pendingAssign.userId });
      setConfirmOpen(false);
      setPendingAssign(null);
    }
  };

  const handleOverrideSubmit = () => {
    if (pendingOverrideUserId && overrideReason.trim()) {
      assignMutation.mutate({
        userId: pendingOverrideUserId,
        overrideReason: overrideReason.trim(),
      });
      setOverrideDialogOpen(false);
      setPendingOverrideUserId(null);
      setOverrideReason("");
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      assignMutation.reset();
      setConfirmOpen(false);
      setPendingAssign(null);
      setOverrideDialogOpen(false);
      setPendingOverrideUserId(null);
      setOverrideReason("");
    }
    onOpenChange(nextOpen);
  };

  const staff: StaffMember[] = staffData?.staff ?? [];
  const validationError = assignMutation.error as
    | (Error & {
        status?: number;
        details?: {
          blocks?: ValidationResult[];
          warnings?: ValidationResult[];
        };
      })
    | undefined;
  const showValidation =
    validationError?.status === 422 && validationError?.details;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col overflow-hidden ">
        <DialogHeader className="shrink-0">
          <DialogTitle>Assign staff</DialogTitle>
          <p className="text-muted-foreground text-sm">
            Staff certified at this location.
          </p>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto max-h-[calc(85vh-7rem)]">
          <div className="min-w-0 space-y-4">
            {showValidation && (
              <ValidationDisplay
                blocks={validationError.details?.blocks ?? []}
                warnings={validationError.details?.warnings ?? []}
                onAssignSuggestion={(userId) => handleAssignClick(userId)}
              />
            )}
            {isLoading ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Loading staff...
              </p>
            ) : (
              <div className="space-y-2">
                {staff.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50 dark:bg-muted/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-muted-foreground truncate text-sm">
                        {s.email}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {s.skills
                          .filter((sk) => requiredSkillIds.includes(sk.id))
                          .map((sk) => (
                            <Badge
                              key={sk.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {sk.name}
                            </Badge>
                          ))}
                      </div>
                    </div>
                      <Button
                        size="sm"
                        onClick={() => handleAssignClick(s.id)}
                        disabled={!shiftId || assignMutation.isPending}
                        className="ml-4 shrink-0"
                      >
                        {assignMutation.isPending &&
                        assignMutation.variables?.userId === s.id
                          ? "Assigning…"
                          : "Assign"}
                      </Button>
                    </div>
                  ))}
                {staff.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No staff available for this location.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPendingAssign(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overtime warning</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p className="text-left">
                {pendingAssign?.preview.message && (
                  <span
                    className="inline-block rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                    data-overtime-preview
                  >
                    {pendingAssign.preview.message}
                  </span>
                )}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAssign}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Assign anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={overrideDialogOpen}
        onOpenChange={(open) => {
          setOverrideDialogOpen(open);
          if (!open) {
            setPendingOverrideUserId(null);
            setOverrideReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>7th consecutive day</AlertDialogTitle>
            <AlertDialogDescription>
              This assignment would be the 7th consecutive working day. A reason
              is required to override. The override will be stored in the audit
              log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <label
              htmlFor="override-reason"
              className="text-sm font-medium leading-none"
            >
              Override reason
            </label>
            <Textarea
              id="override-reason"
              placeholder="e.g. Staff shortage, emergency coverage..."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleOverrideSubmit();
              }}
              disabled={!overrideReason.trim()}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
            >
              Assign with override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
