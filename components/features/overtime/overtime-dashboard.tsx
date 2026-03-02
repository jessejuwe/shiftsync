"use client";

import { Fragment, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeSchedule } from "@/hooks/use-realtime-schedule";
import { format } from "date-fns";
import { getWeekRangeISO } from "@/lib/week-utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  AlertTriangle,
  Calendar,
  DollarSign,
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
import { TablePagination } from "@/components/ui/table-pagination";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { cn } from "@/lib/utils";
import { getQueryClient } from "@/app/get-query-client";

interface StaffAssignment {
  id: string;
  shiftId: string;
  startsAt: string;
  endsAt: string;
  title: string | null;
  hours: number;
}

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
  overtimeHours?: number;
  overtimeCost?: number;
  assignments?: StaffAssignment[];
}

interface OvertimeDashboardData {
  weekStart: string;
  weekEnd: string;
  locationId: string | null;
  weekCount?: number;
  hourlyRate?: number;
  totalProjectedOvertimeCost?: number;
  staff: StaffHours[];
}

const PAGE_SIZE = 10;

export function OvertimeDashboard() {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [weekCount, setWeekCount] = useState(1);
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
    queryKey: ["overtime-dashboard", weekStart, locationId || "all", weekCount],
    queryFn: async () => {
      const params = new URLSearchParams({ weekStart, weekCount: String(weekCount) });
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
      onClockIn: () => {
        queryClient.invalidateQueries({ queryKey: ["on-duty"] });
      },
      onClockOut: () => {
        queryClient.invalidateQueries({ queryKey: ["on-duty"] });
      },
    },
  });

  const staff = data?.staff ?? [];
  const {
    currentPage,
    setCurrentPage,
    paginatedItems: paginatedStaff,
    totalCount,
    showPagination,
  } = useTablePagination(staff, PAGE_SIZE, [weekOffset, locationId, weekCount]);
  const weekStartDate = data?.weekStart
    ? new Date(data.weekStart)
    : new Date(weekStart);
  const periodWeeks = data?.weekCount ?? 1;
  const weekEndDate = data?.weekEnd
    ? new Date(data.weekEnd)
    : (() => {
        const d = new Date(weekStartDate);
        d.setDate(d.getDate() + periodWeeks * 7 - 1);
        return d;
      })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Overtime</h1>
          <p className="text-muted-foreground text-sm">
            35+ approaching, 40+ overtime, 6th/7th consecutive days
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(weekCount)}
            onValueChange={(v) => setWeekCount(parseInt(v, 10))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 week</SelectItem>
              <SelectItem value="2">2 weeks</SelectItem>
              <SelectItem value="4">4 weeks</SelectItem>
            </SelectContent>
          </Select>
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

      {(data?.totalProjectedOvertimeCost ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="size-5" />
              Projected overtime cost this week
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Based on {data?.hourlyRate ?? 25}/hr × 1.5 for hours over 40
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              ${(data?.totalProjectedOvertimeCost ?? 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Staff hours {periodWeeks > 1 ? `(${periodWeeks} weeks)` : "this week"}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Amber = 35+ hours (approaching) • Red = 40+ (overtime) • 6th day
            (amber) • 7+ days (red) highlighted
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
                  <TableHead className="w-10" />
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Consecutive days</TableHead>
                  <TableHead className="text-right">Overtime cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStaff.map((s) => {
                  const rowHighlight = s.overOvertime
                    ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500"
                    : s.approachingOvertime
                      ? "bg-amber-50 dark:bg-amber-950/20 border-l-4 border-l-amber-500"
                      : s.is7thOrMoreConsecutiveDay
                        ? "bg-red-50/70 dark:bg-red-950/15 border-l-4 border-l-red-400"
                        : s.is6thConsecutiveDay
                          ? "bg-amber-50/70 dark:bg-amber-950/15 border-l-4 border-l-amber-400"
                          : "";
                  const hasAssignments = (s.assignments?.length ?? 0) > 0;
                  const isExpanded = expandedUserId === s.userId;
                  return (
                    <Fragment key={s.userId}>
                      <TableRow
                        key={s.userId}
                        className={cn("transition-colors", rowHighlight)}
                      >
                        <TableCell className="w-10">
                          {hasAssignments && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                setExpandedUserId(isExpanded ? null : s.userId)
                              }
                            >
                              {isExpanded ? (
                                <ChevronUp className="size-4" />
                              ) : (
                                <ChevronDown className="size-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
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
                      </TableCell>
                      <TableCell className="text-right">
                        {s.overtimeCost != null && s.overtimeCost > 0 ? (
                          <span className="font-mono text-red-600 dark:text-red-400">
                            ${s.overtimeCost.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
                          {s.is6thConsecutiveDay && !s.is7thOrMoreConsecutiveDay && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-500 text-amber-700 dark:text-amber-400"
                            >
                              <Calendar className="size-3" />
                              6th day
                            </Badge>
                          )}
                          {s.is7thOrMoreConsecutiveDay && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-red-500 text-red-700 dark:text-red-400"
                            >
                              <AlertTriangle className="size-3" />
                              7+ days
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasAssignments && (
                      <TableRow key={`${s.userId}-expanded`}>
                        <TableCell colSpan={6} className="bg-muted/30 py-2">
                          <div className="space-y-1 pl-6">
                            <p className="text-muted-foreground text-xs font-medium">
                              Assignments this week
                            </p>
                            {s.assignments!.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center justify-between gap-4 rounded border bg-background px-3 py-2 text-sm"
                              >
                                <span>
                                  {format(new Date(a.startsAt), "EEE MMM d, HH:mm")} –{" "}
                                  {format(new Date(a.endsAt), "HH:mm")}
                                  {a.title && ` • ${a.title}`}
                                </span>
                                <span className="font-mono text-muted-foreground">
                                  {a.hours}h
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {showPagination && (
            <TablePagination
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
