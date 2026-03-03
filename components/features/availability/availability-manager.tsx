"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getQueryClient } from "@/app/get-query-client";
import { StaffAvailabilityOverview } from "./staff-availability-overview";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const availabilitySchema = z.object({
  locationId: z.string().min(1, "Location is required"),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z
    .string()
    .min(1, "Start time required")
    .refine((v) => /^\d{1,2}:\d{2}(:\d{2})?$/.test(v), "Use HH:mm format"),
  endTime: z
    .string()
    .min(1, "End time required")
    .refine((v) => /^\d{1,2}:\d{2}(:\d{2})?$/.test(v), "Use HH:mm format"),
});

type AvailabilityFormValues = z.infer<typeof availabilitySchema>;

interface AvailabilityWindow {
  id: string;
  userId: string;
  locationId: string;
  location: { id: string; name: string; timezone: string };
  startsAt: string;
  endsAt: string;
  dayOfWeek: number | null;
  isRecurring: boolean;
}

interface Location {
  id: string;
  name: string;
  timezone: string;
}

function formatTimeLocal(utcIso: string, timezone: string): string {
  return formatInTimeZone(utcIso, timezone, "HH:mm");
}

export function AvailabilityManager() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdminOrManager = role === "ADMIN" || role === "MANAGER";

  if (status === "loading") {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (isAdminOrManager) {
    return <StaffAvailabilityOverview />;
  }

  return <MyAvailabilityForm />;
}

function MyAvailabilityForm() {
  const queryClient = getQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: windowsData, isLoading } = useQuery({
    queryKey: ["availability"],
    queryFn: async () => {
      const res = await fetch("/api/availability");
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
  });

  const [desiredHoursValue, setDesiredHoursValue] = useState<string>("");

  const { data: desiredHoursData } = useQuery({
    queryKey: ["desired-hours"],
    queryFn: async () => {
      const res = await fetch("/api/settings/desired-hours");
      if (!res.ok) return { desiredHoursPerWeek: null };
      return res.json();
    },
  });

  useEffect(() => {
    if (desiredHoursData?.desiredHoursPerWeek != null) {
      setDesiredHoursValue(String(desiredHoursData.desiredHoursPerWeek));
    } else {
      setDesiredHoursValue("");
    }
  }, [desiredHoursData?.desiredHoursPerWeek]);

  const desiredHoursMutation = useMutation({
    mutationFn: async (hours: number | null) => {
      const res = await fetch("/api/settings/desired-hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desiredHoursPerWeek: hours }),
      });
      const text = await res.text();
      if (!res.ok) {
        let message = "Failed to update";
        try {
          if (text) message = JSON.parse(text).message ?? message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      return text ? JSON.parse(text) : {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["desired-hours"] });
      queryClient.invalidateQueries({ queryKey: ["fairness-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["availability-all"] });
      toast.success("Desired hours updated");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const { data: locationsData } = useQuery({
    queryKey: ["availability-certified-locations"],
    queryFn: async () => {
      const res = await fetch("/api/availability/certified-locations");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  const form = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      locationId: "",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: AvailabilityFormValues) => {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: values.locationId,
          dayOfWeek: values.dayOfWeek,
          startTime: values.startTime,
          endTime: values.endTime,
          isRecurring: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      setFormOpen(false);
      form.reset();
      toast.success("Availability added");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to add availability",
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: AvailabilityFormValues;
    }) => {
      const res = await fetch(`/api/availability/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek: values.dayOfWeek,
          startTime: values.startTime,
          endTime: values.endTime,
          isRecurring: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      setFormOpen(false);
      setEditingId(null);
      form.reset();
      toast.success("Availability updated");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to update availability",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/availability/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      setDeleteId(null);
      toast.success("Availability removed");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove availability",
      );
    },
  });

  const windows: AvailabilityWindow[] = windowsData?.windows ?? [];
  const locations: Location[] = locationsData?.locations ?? [];

  const groupedByLocation = windows.reduce<
    Record<string, AvailabilityWindow[]>
  >((acc, w) => {
    const key = w.locationId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(w);
    return acc;
  }, {});

  function openEdit(w: AvailabilityWindow) {
    if (!w.isRecurring || w.dayOfWeek == null) return;
    const tz = w.location.timezone;
    form.reset({
      locationId: w.locationId,
      dayOfWeek: w.dayOfWeek,
      startTime: formatTimeLocal(w.startsAt, tz),
      endTime: formatTimeLocal(w.endsAt, tz),
    });
    setEditingId(w.id);
    setFormOpen(true);
  }

  function handleSubmit(values: AvailabilityFormValues) {
    if (editingId) {
      updateMutation.mutate({ id: editingId, values });
    } else {
      createMutation.mutate(values);
    }
  }

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Availability</h1>
        <Button
          onClick={() => {
            form.reset({
              locationId: locations[0]?.id ?? "",
              dayOfWeek: 1,
              startTime: "09:00",
              endTime: "17:00",
            });
            setEditingId(null);
            setFormOpen(true);
          }}
          disabled={locations.length === 0}
        >
          <Plus className="mr-2 size-4" />
          Add availability
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="size-4" />
            Desired hours per week
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Used for fairness analytics. Leave blank to use the default (40h).
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const num =
                desiredHoursValue.trim() === ""
                  ? null
                  : parseFloat(desiredHoursValue);
              if (num !== null && (isNaN(num) || num < 0 || num > 80)) {
                toast.error("Enter a number between 0 and 80");
                return;
              }
              desiredHoursMutation.mutate(num);
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="space-y-2">
              <Label htmlFor="desired-hours" className="sr-only">
                Hours per week
              </Label>
              <Input
                id="desired-hours"
                type="number"
                min={0}
                max={80}
                step={0.5}
                placeholder="40"
                value={desiredHoursValue}
                onChange={(e) => setDesiredHoursValue(e.target.value)}
                disabled={desiredHoursMutation.isPending}
                className="max-w-[120px]"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={desiredHoursMutation.isPending}
            >
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      {locations.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              You need to be certified at a location before adding availability.
              Contact your manager to get certified.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : windows.length === 0 && locations.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              No availability windows yet. Add when you&apos;re available to
              work at each location.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByLocation).map(([locationId, locWindows]) => {
            const loc = locWindows[0]?.location;
            return (
              <Card key={locationId}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {loc?.name ?? "Unknown"}
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">
                    {loc?.timezone}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {locWindows
                      .filter((w) => w.isRecurring && w.dayOfWeek != null)
                      .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0))
                      .map((w) => (
                        <li
                          key={w.id}
                          className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Badge tag="day">
                              {DAY_NAMES[w.dayOfWeek ?? 0]}
                            </Badge>
                            <span className="text-sm">
                              {formatTimeLocal(w.startsAt, w.location.timezone)}{" "}
                              – {formatTimeLocal(w.endsAt, w.location.timezone)}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEdit(w)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(w.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit availability" : "Add availability"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!editingId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of week</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DAY_NAMES.map((name, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Times are in the location&apos;s timezone.
              </p>
              <Button type="submit" disabled={isPending}>
                {editingId ? "Update" : "Add"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete availability</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this availability window. You can add it again
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
