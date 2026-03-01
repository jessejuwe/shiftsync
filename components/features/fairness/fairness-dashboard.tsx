"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addWeeks, subWeeks } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
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
import { cn } from "@/lib/utils";

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
}

interface FairnessDashboardData {
  weekStart: string;
  weekEnd: string;
  locationId: string | null;
  targetHours: number;
  staff: StaffFairness[];
}

function getWeekRange(weekOffset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  let monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  if (weekOffset !== 0) {
    monday =
      weekOffset > 0 ? addWeeks(monday, weekOffset) : subWeeks(monday, -weekOffset);
  }
  return monday.toISOString();
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

const premiumChartConfig = {
  premium: {
    label: "Premium shifts (Fri/Sat eve)",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function FairnessDashboard() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [locationId, setLocationId] = useState<string>("");

  const weekStart = getWeekRange(weekOffset);

  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["fairness-dashboard", weekStart, locationId || "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ weekStart });
      if (locationId) params.set("locationId", locationId);
      const res = await fetch(`/api/fairness/dashboard?${params}`);
      if (!res.ok) throw new Error("Failed to fetch fairness data");
      return res.json() as Promise<FairnessDashboardData>;
    },
  });

  const locations: { id: string; name: string }[] =
    locationsData?.locations ?? [];
  const staff = data?.staff ?? [];
  const targetHours = data?.targetHours ?? 40;
  const weekStartDate = data?.weekStart
    ? new Date(data.weekStart)
    : new Date(weekStart);
  const weekEndDate = data?.weekEnd
    ? new Date(data.weekEnd)
    : new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  const hoursChartData = staff.map((s) => ({
    name: s.name.split(" ")[0] ?? s.name,
    fullName: s.name,
    hours: s.totalHours,
    target: targetHours,
    premium: s.premiumShifts,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Fairness Analytics</h2>
          <p className="text-muted-foreground text-sm">
            Hours distribution • Premium shifts (Fri/Sat eve) • Over/under
            scheduled
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
              {format(weekStartDate, "MMM d")} – {format(weekEndDate, "MMM d, yyyy")}
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
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="size-5" />
                  Hours per staff
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Target: {targetHours}h • Green = on target, Red = over, Amber =
                  under
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={hoursChartConfig} className="min-h-[280px] w-full">
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5" />
                  Premium shift distribution
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Fri/Sat evening shifts per staff
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={premiumChartConfig} className="min-h-[280px] w-full">
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

          <Card>
            <CardHeader>
              <CardTitle>Staff fairness summary</CardTitle>
              <p className="text-muted-foreground text-sm">
                Over-scheduled (red) = +2h above target • Under-scheduled (amber)
                = -2h below target
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Δ vs target</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                    <TableHead className="text-right">Equity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => {
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
                        <TableCell
                          className={cn(
                            "text-right font-mono font-medium",
                            s.hoursDelta > 0 && "text-red-600 dark:text-red-400",
                            s.hoursDelta < 0 &&
                              "text-amber-700 dark:text-amber-400"
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
                              s.equityScore >= 70 && "text-green-600 dark:text-green-400",
                              s.equityScore < 50 && "text-amber-700 dark:text-amber-400"
                            )}
                          >
                            {s.equityScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {s.isOverScheduled && (
                              <Badge
                                variant="destructive"
                                className="text-xs"
                              >
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
