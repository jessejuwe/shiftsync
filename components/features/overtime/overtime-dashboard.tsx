"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeSchedule } from "@/hooks/use-realtime-schedule";
import { format } from "date-fns";
import { getWeekRangeISO } from "@/lib/week-utils";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getQueryClient } from "@/app/get-query-client";

interface StaffHours {
  userId: string;
  name: string;
  email: string;
  hoursThisWeek: number;
  approachingOvertime: boolean;
  overOvertime: boolean;
  consecutiveDays: number;
  is6thConsecutiveDay: boolean;
  is7thOrMoreConsecutiveDay: boolean;
}

interface OvertimeDashboardData {
  weekStart: string;
  weekEnd: string;
  locationId: string | null;
  staff: StaffHours[];
}

export function OvertimeDashboard() {
  const queryClient = getQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [locationId, setLocationId] = useState<string>("");

  const { weekStart } = getWeekRangeISO(weekOffset);

  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["overtime-dashboard", weekStart, locationId || "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ weekStart });
      if (locationId) params.set("locationId", locationId);
      const res = await fetch(`/api/overtime/dashboard?${params}`);
      if (!res.ok) throw new Error("Failed to fetch overtime data");
      return res.json() as Promise<OvertimeDashboardData>;
    },
  });

  const locations: { id: string; name: string }[] =
    locationsData?.locations ?? [];
  const locationIds = useMemo(
    () => (locationId ? [locationId] : locations.map((l) => l.id)),
    [locationId, locations],
  );

  useRealtimeSchedule({
    locationIds,
    callbacks: {
      onSchedulePublished: () => {
        queryClient.invalidateQueries({ queryKey: ["overtime-dashboard"] });
        queryClient.refetchQueries({ queryKey: ["overtime-dashboard"] });
      },
      onShiftAssigned: () => {
        queryClient.invalidateQueries({ queryKey: ["overtime-dashboard"] });
        queryClient.refetchQueries({ queryKey: ["overtime-dashboard"] });
      },
      onShiftEdited: () => {
        queryClient.invalidateQueries({ queryKey: ["overtime-dashboard"] });
        queryClient.refetchQueries({ queryKey: ["overtime-dashboard"] });
      },
    },
  });

  const staff = data?.staff ?? [];
  const weekStartDate = data?.weekStart
    ? new Date(data.weekStart)
    : new Date(weekStart);
  const weekEndDate = data?.weekEnd
    ? new Date(data.weekEnd)
    : new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Overtime Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Staff hours this week • Highlight 35+ (approaching), 40+ (overtime),
            6th consecutive day
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={locationId || "all"}
            onValueChange={(v) => setLocationId(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[180px] px-2 text-center text-sm">
              {format(weekStartDate, "MMM d")} –{" "}
              {format(weekEndDate, "MMM d, yyyy")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff hours this week</CardTitle>
          <p className="text-muted-foreground text-sm">
            Amber = 35+ hours (approaching) • Red = 40+ (overtime) • 6th day
            highlighted
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              Loading...
            </p>
          ) : staff.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              No staff with assignments this week.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Consecutive days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => {
                  const rowHighlight = s.overOvertime
                    ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500"
                    : s.approachingOvertime
                      ? "bg-amber-50 dark:bg-amber-950/20 border-l-4 border-l-amber-500"
                      : s.is6thConsecutiveDay
                        ? "bg-amber-50/70 dark:bg-amber-950/15 border-l-4 border-l-amber-400"
                        : "";
                  return (
                    <TableRow
                      key={s.userId}
                      className={cn("transition-colors", rowHighlight)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {s.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-mono font-medium",
                            s.overOvertime && "text-red-600 dark:text-red-400",
                            s.approachingOvertime &&
                              !s.overOvertime &&
                              "text-amber-700 dark:text-amber-400",
                          )}
                        >
                          {s.hoursThisWeek}h
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            s.is6thConsecutiveDay &&
                              "font-semibold text-amber-700 dark:text-amber-400",
                            s.is7thOrMoreConsecutiveDay &&
                              "font-semibold text-red-600 dark:text-red-400",
                          )}
                        >
                          {s.consecutiveDays}
                        </span>
                        {s.is6thConsecutiveDay && (
                          <Badge
                            variant="outline"
                            className="ml-2 border-amber-500 text-amber-700 dark:text-amber-400"
                          >
                            6th day
                          </Badge>
                        )}
                        {s.is7thOrMoreConsecutiveDay && (
                          <Badge
                            variant="outline"
                            className="ml-2 border-red-500 text-red-700 dark:text-red-400"
                          >
                            7+ days
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.overOvertime && (
                            <Badge
                              variant="destructive"
                              className="gap-1 text-xs"
                            >
                              <AlertTriangle className="size-3" />
                              Overtime
                            </Badge>
                          )}
                          {s.approachingOvertime && !s.overOvertime && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-500 text-amber-700 dark:text-amber-400"
                            >
                              <Clock className="size-3" />
                              35+
                            </Badge>
                          )}
                          {s.is6thConsecutiveDay && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-500 text-amber-700 dark:text-amber-400"
                            >
                              <Calendar className="size-3" />
                              6th day
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
