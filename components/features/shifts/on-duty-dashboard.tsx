"use client";

import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { UserRound, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
interface OnDutyLocation {
  location: { id: string; name: string; timezone: string };
  staff: {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    shiftStartsAt: string;
    shiftEndsAt: string;
  }[];
}

export function OnDutyDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["on-duty"],
    queryFn: async () => {
      const res = await fetch("/api/shifts/on-duty");
      if (!res.ok) throw new Error("Failed to fetch on-duty staff");
      return res.json();
    },
    refetchInterval: 30_000, // Refresh every 30s for live feel
  });

  const locations: OnDutyLocation[] = data?.locations ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-5" />
          On duty now
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Staff currently working at each location
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Loading...
          </p>
        ) : locations.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No one is currently on shift
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => (
              <div
                key={loc.location.id}
                className="rounded-lg border p-4"
              >
                <div className="mb-3 flex items-center gap-2 font-medium">
                  <MapPin className="size-4 text-muted-foreground" />
                  {loc.location.name}
                </div>
                <ul className="space-y-2">
                  {loc.staff.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{s.userName}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatInTimeZone(
                          s.shiftStartsAt,
                          loc.location.timezone,
                          "HH:mm"
                        )}
                        –
                        {formatInTimeZone(
                          s.shiftEndsAt,
                          loc.location.timezone,
                          "HH:mm"
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
