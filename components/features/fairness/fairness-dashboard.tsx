"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeSchedule } from "@/hooks/use-realtime-schedule";
import { format } from "date-fns";
import { getWeekRangeISO } from "@/lib/week-utils";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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

interface StaffFairness {
  userId: string;
  name: string;
  email: string;
  totalHours: number;
  premiumShifts: number;
  hoursDelta: number;
  equityScore: number;
  isOverScheduled: boolean;
  isUnderScheduled: boolean;
  desiredHoursPerWeek?: number;
  targetHours?: number;
}

interface FairnessDashboardData {
  weekStart: string;
  weekEnd: string;
  locationId: string | null;
  weekCount?: number;
  targetHours: number;
  staff: StaffFairness[];
}

const hoursChartConfig = {
  hours: {
    label: "Hours",
    color: "hsl(var(--chart-1))",
  },
  target: {
    label: "Target",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig;

const PAGE_SIZE = 10;

const premiumChartConfig = {
  premium: {
    label: "Premium shifts (Fri/Sat eve)",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function FairnessDashboard() {
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

  const [weekCount, setWeekCount] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["fairness-dashboard", weekStart, locationId || "all", weekCount],
    queryFn: async () => {
      const params = new URLSearchParams({ weekStart, weekCount: String(weekCount) });
      if (locationId) params.set("locationId", locationId);
      const res = await fetch(`/api/fairness/dashboard?${params}`);
      if (!res.ok) throw new Error("Failed to fetch fairness data");
      return res.json() as Promise<FairnessDashboardData>;
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
        queryClient.invalidateQueries({ queryKey: ["fairness-dashboard"] });
        queryClient.refetchQueries({ queryKey: ["fairness-dashboard"] });
      },
      onShiftAssigned: () => {
        queryClient.invalidateQueries({ queryKey: ["fairness-dashboard"] });
        queryClient.refetchQueries({ queryKey: ["fairness-dashboard"] });
      },
      onShiftEdited: () => {
        queryClient.invalidateQueries({ queryKey: ["fairness-dashboard"] });
        queryClient.refetchQueries({ queryKey: ["fairness-dashboard"] });
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
  const targetHours = data?.targetHours ?? 40;
  const periodWeeks = data?.weekCount ?? 1;
  const weekStartDate = data?.weekStart
    ? new Date(data.weekStart)
    : new Date(weekStart);
  const weekEndDate = data?.weekEnd
    ? new Date(data.weekEnd)
    : (() => {
        const d = new Date(weekStartDate);
        d.setDate(d.getDate() + (periodWeeks * 7 - 1));
        return d;
      })();

  const chartTarget = targetHours * periodWeeks;
  const hoursChartData = staff.map((s) => ({
    name: s.name.split(" ")[0] ?? s.name,
    fullName: s.name,
    hours: s.totalHours,
    target: chartTarget,
    premium: s.premiumShifts,
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">Fairness Analytics</h2>
          <p className="text-muted-foreground text-sm">
            Hours distribution • Premium shifts (Fri/Sat eve) • Over/under
            scheduled
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
              className="h-8 w-8 shrink-0 touch-manipulation"
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[120px] shrink-0 px-2 text-center text-sm sm:min-w-[180px]">
              {format(weekStartDate, "MMM d")} –{" "}
              {format(weekEndDate, "MMM d, yyyy")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 touch-manipulation"
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          Loading...
        </p>
      ) : staff.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No staff with assignments this week.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="size-5 shrink-0" />
                  Hours per staff
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Target: {chartTarget}h ({periodWeeks} week{periodWeeks > 1 ? "s" : ""}) • Green = on target, Red = over, Amber = under
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={hoursChartConfig}
                  className="aspect-auto h-[220px] w-full min-w-0 sm:h-[280px]"
                >
                  <BarChart
                    accessibilityLayer
                    data={hoursChartData}
                    margin={{ top: 20, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      domain={[0, "auto"]}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value) => [`${value}h`, "Hours"]}
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.fullName ?? ""
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="hours"
                      fill="var(--color-hours)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 shrink-0" />
                  Premium shift distribution
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Fri/Sat evening shifts per staff
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={premiumChartConfig}
                  className="aspect-auto h-[220px] w-full min-w-0 sm:h-[280px]"
                >
                  <BarChart
                    accessibilityLayer
                    data={hoursChartData}
                    margin={{ top: 20, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      allowDecimals={false}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value) => [`${value}`, "Premium shifts"]}
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.fullName ?? ""
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="premium"
                      fill="var(--color-premium)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>Staff fairness summary</CardTitle>
              <p className="text-muted-foreground text-sm">
                Over-scheduled (red) = +2h above target • Under-scheduled
                (amber) = -2h below target
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Desired</TableHead>
                    <TableHead className="text-right">Δ vs target</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                    <TableHead className="text-right">Equity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStaff.map((s) => {
                    const rowHighlight = s.isOverScheduled
                      ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500"
                      : s.isUnderScheduled
                        ? "bg-amber-50 dark:bg-amber-950/20 border-l-4 border-l-amber-500"
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
                        <TableCell className="text-right font-mono">
                          {s.totalHours}h
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {s.desiredHoursPerWeek != null
                            ? `${s.desiredHoursPerWeek}h/wk`
                            : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono font-medium",
                            s.hoursDelta > 0 &&
                              "text-red-600 dark:text-red-400",
                            s.hoursDelta < 0 &&
                              "text-amber-700 dark:text-amber-400",
                          )}
                        >
                          {s.hoursDelta >= 0 ? "+" : ""}
                          {s.hoursDelta}h
                        </TableCell>
                        <TableCell className="text-right">
                          {s.premiumShifts}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "font-medium",
                              s.equityScore >= 70 &&
                                "text-green-600 dark:text-green-400",
                              s.equityScore < 50 &&
                                "text-amber-700 dark:text-amber-400",
                            )}
                          >
                            {s.equityScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {s.isOverScheduled && (
                              <Badge variant="destructive" className="text-xs">
                                Over
                              </Badge>
                            )}
                            {s.isUnderScheduled && (
                              <Badge
                                variant="outline"
                                className="border-amber-500 text-amber-700 dark:text-amber-400"
                              >
                                Under
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
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
        </>
      )}
    </div>
  );
}
