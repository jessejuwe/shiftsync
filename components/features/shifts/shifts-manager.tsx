"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRealtimeSchedule } from "@/hooks/use-realtime-schedule";
import { format } from "date-fns";
import { getWeekRangeISO } from "@/lib/week-utils";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShiftCreateForm } from "./shift-create-form";
import { ShiftEditForm } from "./shift-edit-form";
import { StaffSelectModal } from "./staff-select-modal";
import { SwapRequestModal } from "./swap-request-modal";
import { SwapRequestsPanel } from "./swap-requests-panel";
import { ManagerSwapApprovalsPanel } from "./manager-swap-approvals-panel";
import { OnDutyDashboard } from "./on-duty-dashboard";
import { WeekNavigator } from "./week-navigator";
import { SchedulePublishBar } from "./schedule-publish-bar";
import { ShiftCard } from "./shift-card";
import { getQueryClient } from "@/app/get-query-client";
import type { Shift, Location, Skill } from "./types";

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
    requiredSkills: { id: string; name: string }[];
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
      queryClient.invalidateQueries({ queryKey: ["on-duty"] });
      toast.success("Staff unassigned");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to unassign");
    },
  });

  const clockInMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(`/api/shifts/assignments/${assignmentId}/clock-in`, {
        method: "POST",
      });
      const text = await res.text();
      let data: { message?: string } = {};
      try {
        data = text ? (JSON.parse(text) as { message?: string }) : {};
      } catch {
        if (!res.ok) throw new Error("Server returned an invalid response");
      }
      if (!res.ok) throw new Error(data.message ?? "Failed to clock in");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["on-duty"] });
      toast.success("Clocked in");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to clock in");
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(`/api/shifts/assignments/${assignmentId}/clock-out`, {
        method: "POST",
      });
      const text = await res.text();
      let data: { message?: string } = {};
      try {
        data = text ? (JSON.parse(text) as { message?: string }) : {};
      } catch {
        if (!res.ok) throw new Error("Server returned an invalid response");
      }
      if (!res.ok) throw new Error(data.message ?? "Failed to clock out");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["on-duty"] });
      toast.success("Clocked out");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to clock out");
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
        headcount?: number;
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
      toast.success("Shift updated");
    },
    onError: (err: Error) => {
      setEditError(err.message);
      toast.error(err.message);
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
      toast.success("Shift picked up");
    },
    onError: (err: Error) => {
      setPickupError(err.message);
      toast.error(err.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: {
      locationId: string;
      startsAt: string;
      endsAt: string;
      title?: string;
      notes?: string;
      headcount?: number;
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
      toast.success("Shift created", {
        description: "Assign staff to this shift",
      });
      setStaffModalShift({
        id: data.shift.id,
        locationId: data.shift.locationId,
        requiredSkillIds:
          data.shift.requiredSkills?.map((s: { id: string }) => s.id) ?? [],
        requiredSkills: data.shift.requiredSkills ?? [],
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create shift");
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({
      locationId,
      shiftIds,
    }: {
      locationId: string;
      shiftIds: string[];
    }) => {
      const res = await fetch("/api/shifts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, shiftIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to publish");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Schedule published", {
        description: "Shifts are now visible to staff",
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to publish");
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async ({
      locationId,
      shiftIds,
    }: {
      locationId: string;
      shiftIds: string[];
    }) => {
      const res = await fetch("/api/shifts/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, shiftIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to unpublish");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Schedule unpublished", {
        description: "Shifts are now hidden from staff",
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to unpublish");
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

  const shiftsByLocation = useMemo(() => {
    const map = new Map<
      string,
      { location: { id: string; name: string }; shifts: Shift[] }
    >();
    for (const shift of shifts) {
      const loc = shift.location;
      const existing = map.get(loc.id);
      if (existing) {
        existing.shifts.push(shift);
      } else {
        map.set(loc.id, { location: loc, shifts: [shift] });
      }
    }
    return Array.from(map.values());
  }, [shifts]);

  useRealtimeSchedule({
    locationIds,
    userId: currentUserId ?? undefined,
    callbacks: {
      onSchedulePublished: () => {
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.refetchQueries({ queryKey: ["shifts"] });
      },
      onShiftAssigned: () => {
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.invalidateQueries({ queryKey: ["on-duty"] });
        queryClient.refetchQueries({ queryKey: ["shifts"] });
        queryClient.refetchQueries({ queryKey: ["on-duty"] });
      },
      onShiftUnassigned: () => {
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.invalidateQueries({ queryKey: ["on-duty"] });
        queryClient.refetchQueries({ queryKey: ["shifts"] });
        queryClient.refetchQueries({ queryKey: ["on-duty"] });
      },
      onShiftEdited: () => {
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.refetchQueries({ queryKey: ["shifts"] });
      },
      onClockIn: () => {
        queryClient.invalidateQueries({ queryKey: ["on-duty"] });
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
      },
      onClockOut: () => {
        queryClient.invalidateQueries({ queryKey: ["on-duty"] });
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
      },
      onSwapRequested: () => {
        queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
        queryClient.refetchQueries({ queryKey: ["swap-requests"] });
        toast.info("You have a new swap request");
      },
      onSwapApproved: () => {
        queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.refetchQueries({ queryKey: ["swap-requests"] });
        queryClient.refetchQueries({ queryKey: ["shifts"] });
      },
    },
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Shifts</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {canManage
              ? "Create shifts and assign staff. Violations are shown when assigning."
              : "View your shifts. Request swaps, offer shifts up, or pick up available shifts."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WeekNavigator
            monday={monday}
            sunday={sunday}
            weekOffset={weekOffset}
            onWeekChange={(delta) => setWeekOffset((o) => o + delta)}
            onJumpToToday={() => setWeekOffset(0)}
          />
          {canManage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setCreateModalOpen(true)} className="min-h-[44px] touch-manipulation sm:min-h-9">
                  <Plus className="size-4" />
                  Create shift
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create a new shift with location, time, and skills</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {canManage && shiftsByLocation.length > 0 && (
        <SchedulePublishBar
          shiftsByLocation={shiftsByLocation}
          onPublish={(locationId, shiftIds) =>
            publishMutation.mutate({ locationId, shiftIds })
          }
          onUnpublish={(locationId, shiftIds) =>
            unpublishMutation.mutate({ locationId, shiftIds })
          }
          isPublishPending={publishMutation.isPending}
          isUnpublishPending={unpublishMutation.isPending}
        />
      )}

      {isStaff && currentUserId && (
        <SwapRequestsPanel currentUserId={currentUserId} />
      )}
      {canManage && currentUserId && (
        <ManagerSwapApprovalsPanel currentUserId={currentUserId} />
      )}
      <OnDutyDashboard />

      {isLoading ? (
        <p className="text-muted-foreground">Loading shifts...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              canManage={canManage}
              isStaff={isStaff}
              currentUserId={currentUserId}
              actions={{
                onEdit: setEditModalShift,
                onAssignStaff: () =>
                  setStaffModalShift({
                    id: shift.id,
                    locationId: shift.locationId,
                    requiredSkillIds: shift.requiredSkills.map((s) => s.id),
                    requiredSkills: shift.requiredSkills,
                  }),
                onUnassign: (id) => unassignMutation.mutate(id),
                onPublish: (locationId, shiftIds) =>
                  publishMutation.mutate({ locationId, shiftIds }),
                onUnpublish: (locationId, shiftIds) =>
                  unpublishMutation.mutate({ locationId, shiftIds }),
                onClockIn: (id) => clockInMutation.mutate(id),
                onClockOut: (id) => clockOutMutation.mutate(id),
                onRequestSwap: (assignmentId, _userId, user, shiftId) =>
                  setSwapModalAssignment({ id: assignmentId, userId: user.id, user, shiftId }),
                onOfferUp: (assignmentId) => unassignMutation.mutate(assignmentId),
                onPickup: setPickupModalShift,
                isUnassignPending: unassignMutation.isPending,
                isPublishPending: publishMutation.isPending,
                isUnpublishPending: unpublishMutation.isPending,
                isClockInPending: clockInMutation.isPending,
                isClockOutPending: clockOutMutation.isPending,
              }}
            />
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
                headcount: values.headcount ?? 1,
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
                      headcount: values.headcount ?? 1,
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
        requiredSkills={staffModalShift?.requiredSkills ?? []}
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
