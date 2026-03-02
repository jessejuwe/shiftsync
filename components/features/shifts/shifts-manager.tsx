"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRealtimeSchedule } from "@/hooks/use-realtime-schedule";
import { format } from "date-fns";
import { getWeekRangeISO } from "@/lib/week-utils";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
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
import { StaffSelectModal } from "./staff-select-modal";
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
  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to } = getWeekRangeISO(weekOffset);
  const monday = new Date(from);
  const sunday = new Date(to);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [staffModalShift, setStaffModalShift] = useState<{
    id: string;
    locationId: string;
    requiredSkillIds: string[];
  } | null>(null);

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
            Create shifts and assign staff. Violations are shown when assigning.
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
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="size-4" />
            Create shift
          </Button>
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
                  <div className="text-sm">
                    <span className="text-muted-foreground">Assigned: </span>
                    {shift.assignments.map((a) => a.user.name).join(", ")}
                  </div>
                )}
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
              </CardContent>
            </Card>
          ))}
          {shifts.length === 0 && (
            <p className="text-muted-foreground col-span-full py-8 text-center">
              No shifts this week. Create one to get started.
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

      <StaffSelectModal
        open={!!staffModalShift}
        onOpenChange={(open) => !open && setStaffModalShift(null)}
        shiftId={staffModalShift?.id ?? null}
        shiftLocationId={staffModalShift?.locationId ?? null}
        requiredSkillIds={staffModalShift?.requiredSkillIds ?? []}
        onAssignSuccess={() => setStaffModalShift(null)}
      />
    </div>
  );
}
