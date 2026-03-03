"use client";

import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

interface StaffWithWindows {
  id: string;
  name: string;
  email: string;
  role: string;
  desiredHoursPerWeek?: number | null;
  windows: AvailabilityWindow[];
}

function formatTimeLocal(utcIso: string, timezone: string): string {
  return formatInTimeZone(utcIso, timezone, "HH:mm");
}

export function StaffAvailabilityOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["availability-all"],
    queryFn: async () => {
      const res = await fetch("/api/availability/all");
      if (!res.ok) throw new Error("Failed to fetch staff availability");
      return res.json();
    },
  });

  const staff: StaffWithWindows[] = data?.staff ?? [];

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">Loading staff availability…</p>
    );
  }

  if (staff.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            No staff found.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Staff Availability</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          View availability for all staff and managers
        </p>
      </div>

      <div className="space-y-6">
        {staff.map((s) => {
          const byLocation = s.windows.reduce<
            Record<string, AvailabilityWindow[]>
          >((acc, w) => {
            const key = w.locationId;
            if (!acc[key]) acc[key] = [];
            acc[key].push(w);
            return acc;
          }, {});

          return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{s.name}</CardTitle>
                  {s.role === "MANAGER" && (
                    <Badge variant="secondary" className="w-fit">
                      Manager
                    </Badge>
                  )}
                  {s.desiredHoursPerWeek != null && (
                    <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      <Target className="size-4" />
                      {s.desiredHoursPerWeek}h/week
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">{s.email}</p>
              </CardHeader>
              <CardContent>
                {s.windows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No availability set
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(byLocation).map(([locationId, locWindows]) => {
                      const loc = locWindows[0]?.location;
                      return (
                        <div key={locationId}>
                          <p className="text-muted-foreground mb-2 text-sm font-medium">
                            {loc?.name ?? "Unknown"} ({loc?.timezone})
                          </p>
                          <ul className="space-y-2">
                            {locWindows
                              .filter((w) => w.isRecurring && w.dayOfWeek != null)
                              .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0))
                              .map((w) => (
                                <li
                                  key={w.id}
                                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                                >
                                  <Badge variant="secondary">
                                    {DAY_NAMES[w.dayOfWeek ?? 0]}
                                  </Badge>
                                  <span className="text-sm">
                                    {formatTimeLocal(
                                      w.startsAt,
                                      w.location.timezone
                                    )}{" "}
                                    –{" "}
                                    {formatTimeLocal(
                                      w.endsAt,
                                      w.location.timezone
                                    )}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
