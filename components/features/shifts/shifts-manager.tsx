"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRealtimeSchedule } from "@/hooks/use-realtime-schedule";
import { format } from "date-fns";
import { getWeekRangeISO } from "@/lib/week-utils";
import { Plus, ChevronLeft, ChevronRight, X, Pencil, ArrowLeftRight, Gift, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShiftCreateForm } from "./shift-create-form";
import { ShiftEditForm } from "./shift-edit-form";
import { StaffSelectModal } from "./staff-select-modal";
import { SwapRequestModal } from "./swap-request-modal";
import { getQueryClient } from "@/app/get-query-client";

interface Shift {
  id: string;
  locationId: string;
  location: { id: string; name: string; timezone: string };
  startsAt: string;
  endsAt: string;
  title: string | null;
  notes: string | null;
  isPublished: boolean;
  requiredSkills: { id: string; name: string }[];
  assignments: {
    id: string;
    userId: string;
    user: { id: string; name: string; email: string };
    status: string;
  }[];
}

interface Location {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
}

interface Skill {
  id: string;
  name: string;
  description: string | null;
}

export function ShiftsManager() {
  const queryClient = getQueryClient();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const currentUserId = session?.user?.id ?? null;
  const isStaff = role === "STAFF";
  const canManage = role === "ADMIN" || role === "MANAGER";

  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to } = getWeekRangeISO(weekOffset);
  const monday = new Date(from);
  const sunday = new Date(to);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalShift, setEditModalShift] = useState<Shift | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [staffModalShift, setStaffModalShift] = useState<{
    id: string;
    locationId: string;
    requiredSkillIds: string[];
  } | null>(null);
  const [swapModalAssignment, setSwapModalAssignment] = useState<{
    id: string;
    userId: string;
    user: { id: string; name: string; email: string };
    shiftId: string;
  } | null>(null);
  const [pickupModalShift, setPickupModalShift] = useState<Shift | null>(null);
  const [pickupError, setPickupError] = useState<string | null>(null);

  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ["shifts", from, to],
    queryFn: async () => {
      const res = await fetch(
        "/api/shifts?from=" +
          encodeURIComponent(from) +
          "&to=" +
          encodeURIComponent(to),
      );
      if (!res.ok) throw new Error("Failed to fetch shifts");
      return res.json();
    },
  });

  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  const { data: skillsData } = useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const res = await fetch("/api/skills");
      if (!res.ok) throw new Error("Failed to fetch skills");
      return res.json();
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(`/api/shifts/assignments/${assignmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to unassign");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({
      shiftId,
      body,
    }: {
      shiftId: string;
      body: {
        startsAt: string;
        endsAt: string;
        title?: string;
        notes?: string;
        requiredSkillIds?: string[];
      };
    }) => {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to update shift");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setEditModalShift(null);
      setEditError(null);
    },
    onError: (err: Error) => {
      setEditError(err.message);
    },
  });

  const pickupMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      if (!currentUserId) throw new Error("Not signed in");
      const res = await fetch("/api/shifts/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, userId: currentUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message ?? "Failed to pick up shift") as Error & { details?: unknown };
        err.details = data.details;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setPickupModalShift(null);
      setPickupError(null);
    },
    onError: (err: Error) => {
      setPickupError(err.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: {
      locationId: string;
      startsAt: string;
      endsAt: string;
      title?: string;
      notes?: string;
      requiredSkillIds?: string[];
    }) => {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to create shift");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setCreateModalOpen(false);
      setStaffModalShift({
        id: data.shift.id,
        locationId: data.shift.locationId,
        requiredSkillIds:
          data.shift.requiredSkills?.map((s: { id: string }) => s.id) ?? [],
      });
    },
  });

  const shifts: Shift[] = shiftsData?.shifts ?? [];
  const locations: Location[] = locationsData?.locations ?? [];
  const skills: Skill[] = skillsData?.skills ?? [];
  const locationIds = useMemo(
    () => [
      ...new Set([
        ...locations.map((l) => l.id),
        ...shifts.map((s) => s.locationId),
      ]),
    ],
    [locations, shifts],
  );

  useRealtimeSchedule({
    locationIds,
    callbacks: {
      onSchedulePublished: () => {
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.refetchQueries({ queryKey: ["shifts"] });
      },
      onShiftAssigned: () => {
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.refetchQueries({ queryKey: ["shifts"] });
      },
      onShiftUnassigned: () => {
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.refetchQueries({ queryKey: ["shifts"] });
      },
      onShiftEdited: () => {
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.refetchQueries({ queryKey: ["shifts"] });
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shifts</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {canManage
              ? "Create shifts and assign staff. Violations are shown when assigning."
              : "View your shifts. Request swaps, offer shifts up, or pick up available shifts."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="h-9 w-9"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[140px] px-3 py-1.5 text-center text-sm font-medium">
              {format(monday, "MMM d")} – {format(sunday, "MMM d")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="h-9 w-9"
            >
              <ChevronRight className="size-4" />
            </Button>
            {weekOffset !== 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekOffset(0)}
                className="h-8 text-xs"
              >
                Today
              </Button>
            )}
          </div>
          {canManage && (
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="size-4" />
              Create shift
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading shifts...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shifts.map((shift) => (
            <Card
              key={shift.id}
              className="overflow-hidden transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {format(new Date(shift.startsAt), "MMM d, HH:mm")} –{" "}
                  {format(new Date(shift.endsAt), "HH:mm")}
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  {shift.location.name}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {shift.requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {shift.requiredSkills.map((s) => (
                      <Badge key={s.id} variant="secondary">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {shift.assignments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground shrink-0">
                      Assigned:
                    </span>
                    {shift.assignments.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-0.5 rounded-md bg-muted px-2 py-0.5"
                      >
                        {a.user.name}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => unassignMutation.mutate(a.id)}
                            disabled={unassignMutation.isPending}
                            className="ml-0.5 rounded p-0.5 hover:bg-destructive/20 hover:text-destructive disabled:opacity-50"
                            title="Unassign"
                            aria-label={`Unassign ${a.user.name}`}
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditModalShift(shift)}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStaffModalShift({
                            id: shift.id,
                            locationId: shift.locationId,
                            requiredSkillIds: shift.requiredSkills.map((s) => s.id),
                          })
                        }
                      >
                        Assign staff
                      </Button>
                    </>
                  )}
                  {isStaff && currentUserId && (
                    <>
                      {shift.assignments.some((a) => a.userId === currentUserId) && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const a = shift.assignments.find((x) => x.userId === currentUserId)!;
                              setSwapModalAssignment({ ...a, shiftId: shift.id });
                            }}
                          >
                            <ArrowLeftRight className="size-3.5" />
                            Request swap
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unassignMutation.mutate(shift.assignments.find((a) => a.userId === currentUserId)!.id)}
                            disabled={unassignMutation.isPending}
                          >
                            <Gift className="size-3.5" />
                            Offer up
                          </Button>
                        </>
                      )}
                      {!shift.assignments.some((a) => a.userId === currentUserId) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPickupModalShift(shift)}
                        >
                          <UserPlus className="size-3.5" />
                          Pick up
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {shifts.length === 0 && (
            <p className="text-muted-foreground col-span-full py-8 text-center">
              {canManage
                ? "No shifts this week. Create one to get started."
                : "No shifts this week."}
            </p>
          )}
        </div>
      )}

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create shift</DialogTitle>
          </DialogHeader>
          <ShiftCreateForm
            locations={locations}
            skills={skills}
            onSubmit={async (values) => {
              await createMutation.mutateAsync({
                locationId: values.locationId,
                startsAt: values.startsAt,
                endsAt: values.endsAt,
                title: values.title || undefined,
                notes: values.notes || undefined,
                requiredSkillIds: values.requiredSkillIds?.length
                  ? values.requiredSkillIds
                  : undefined,
              });
            }}
            onSuccess={() => {}}
            isPending={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editModalShift}
        onOpenChange={(open) => {
          if (!open) {
            setEditModalShift(null);
            setEditError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit shift</DialogTitle>
          </DialogHeader>
          {editModalShift && (
            <ShiftEditForm
              shift={editModalShift}
              locations={locations}
              skills={skills}
              onSubmit={async (values) => {
                setEditError(null);
                try {
                  await editMutation.mutateAsync({
                    shiftId: editModalShift.id,
                    body: {
                      startsAt: values.startsAt,
                      endsAt: values.endsAt,
                      title: values.title || undefined,
                      notes: values.notes || undefined,
                    requiredSkillIds: values.requiredSkillIds,
                    },
                  });
                } catch (err) {
                  setEditError(
                    err instanceof Error ? err.message : "Failed to update shift"
                  );
                  throw err;
                }
              }}
              onSuccess={() => setEditModalShift(null)}
              isPending={editMutation.isPending}
              error={editError}
            />
          )}
        </DialogContent>
      </Dialog>

      <StaffSelectModal
        open={!!staffModalShift}
        onOpenChange={(open) => !open && setStaffModalShift(null)}
        shiftId={staffModalShift?.id ?? null}
        shiftLocationId={staffModalShift?.locationId ?? null}
        requiredSkillIds={staffModalShift?.requiredSkillIds ?? []}
        onAssignSuccess={() => setStaffModalShift(null)}
      />

      {isStaff && (
        <Dialog
          open={!!pickupModalShift}
          onOpenChange={(open) => {
            if (!open) {
              setPickupModalShift(null);
              setPickupError(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pick up shift</DialogTitle>
            </DialogHeader>
            {pickupModalShift && (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  {format(new Date(pickupModalShift.startsAt), "MMM d, HH:mm")} –{" "}
                  {format(new Date(pickupModalShift.endsAt), "HH:mm")} at{" "}
                  {pickupModalShift.location.name}
                </p>
                {pickupError && (
                  <p className="text-destructive text-sm">{pickupError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPickupModalShift(null);
                      setPickupError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setPickupError(null);
                      pickupMutation.mutate(pickupModalShift.id);
                    }}
                    disabled={pickupMutation.isPending}
                  >
                    {pickupMutation.isPending ? "Picking up…" : "Pick up"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {isStaff && (
        <SwapRequestModal
          open={!!swapModalAssignment}
          onOpenChange={(open) => !open && setSwapModalAssignment(null)}
          assignment={swapModalAssignment}
          shifts={shifts}
          currentUserId={currentUserId!}
          onSuccess={() => {
            setSwapModalAssignment(null);
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
          }}
        />
      )}
    </div>
  );
}
