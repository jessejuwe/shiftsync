"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ValidationDisplay } from "./validation-display";
import type { ValidationResult } from "./validation-display";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: { id: string; name: string }[];
  certifications: { id: string; locationId: string; locationName: string; expiresAt: string }[];
}

interface StaffSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string | null;
  shiftLocationId: string | null;
  requiredSkillIds: string[];
  onAssignSuccess: () => void;
  onAssignError?: (error: unknown) => void;
}

export function StaffSelectModal({
  open,
  onOpenChange,
  shiftId,
  shiftLocationId,
  requiredSkillIds,
  onAssignSuccess,
  onAssignError,
}: StaffSelectModalProps) {
  const queryClient = useQueryClient();

  const { data: staffData, isLoading } = useQuery({
    queryKey: ["staff", shiftLocationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (shiftLocationId) params.set("locationId", shiftLocationId);
      const res = await fetch("/api/staff?" + params);
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
    enabled: open && !!shiftLocationId,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      if (!shiftId) throw new Error("No shift selected");
      const res = await fetch("/api/shifts/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message ?? "Assignment failed") as Error & {
          status?: number;
          details?: { blocks?: ValidationResult[]; warnings?: ValidationResult[] };
        };
        err.status = res.status;
        err.details = data.details;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      onAssignSuccess();
      onOpenChange(false);
    },
    onError: (err) => {
      onAssignError?.(err);
    },
  });

  const staff: StaffMember[] = staffData?.staff ?? [];
  const validationError = assignMutation.error as (Error & {
    status?: number;
    details?: { blocks?: ValidationResult[]; warnings?: ValidationResult[] };
  }) | undefined;
  const showValidation =
    validationError?.status === 422 && validationError?.details;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign staff</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {showValidation && (
            <ValidationDisplay
              blocks={validationError.details?.blocks ?? []}
              warnings={validationError.details?.warnings ?? []}
              onAssignSuggestion={(userId) =>
                assignMutation.mutate({ userId })
              }
            />
          )}
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Loading staff...</p>
          ) : (
            <ScrollArea className="h-[320px] pr-4">
              <div className="space-y-2">
                {staff.map((s) => {
                  const hasAllSkills =
                    requiredSkillIds.length === 0 ||
                    requiredSkillIds.every((rid) => s.skills.some((sk) => sk.id === rid));
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted/50 ${
                        !hasAllSkills ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-muted-foreground truncate text-sm">{s.email}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.skills.map((sk) => (
                            <Badge
                              key={sk.id}
                              variant={requiredSkillIds.includes(sk.id) ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {sk.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => assignMutation.mutate({ userId: s.id })}
                        disabled={!shiftId || assignMutation.isPending}
                        className="ml-4 shrink-0"
                      >
                        {assignMutation.isPending ? "Assigning…" : "Assign"}
                      </Button>
                    </div>
                  );
                })}
                {staff.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No staff available for this location.
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
