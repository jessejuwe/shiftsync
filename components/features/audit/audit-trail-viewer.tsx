"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Download, FileText, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { AuditLogAction } from "@/generated/prisma/enums";

interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  changes: unknown;
  locationId: string | null;
  locationName: string | null;
  timestamp: string;
}

interface AuditResponse {
  entries: AuditEntry[];
}

function JsonBlock({ data, label }: { data: unknown; label: string }) {
  if (data == null) return null;
  const str = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <pre className="bg-muted max-h-40 overflow-auto rounded-md p-2 text-xs">
        {str}
      </pre>
    </div>
  );
}

function ExpandableJson({
  before,
  after,
  changes,
}: {
  before: unknown;
  after: unknown;
  changes: unknown;
}) {
  const hasBefore = before != null;
  const hasAfter = after != null;
  const hasChanges = changes != null && !hasBefore && !hasAfter;
  const hasContent = hasBefore || hasAfter || hasChanges;

  if (!hasContent)
    return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <Collapsible className="group">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-left text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
          View details
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-3 rounded-md border p-3">
          {hasBefore && <JsonBlock data={before} label="Before" />}
          {hasAfter && <JsonBlock data={after} label="After" />}
          {hasChanges && <JsonBlock data={changes} label="Changes" />}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const ACTION_CONFIG: Record<AuditLogAction, { label: string }> = {
  SHIFT_CREATED: { label: "Shift Created" },
  SHIFT_EDITED: { label: "Shift Edited" },
  SHIFT_PUBLISHED: { label: "Shift Published" },
  SHIFT_ASSIGNED: { label: "Shift Assigned" },
  SHIFT_UNASSIGNED: { label: "Shift Unassigned" },
  OVERRIDE_7TH_DAY: { label: "7th Day Override" },
  SWAP_REQUEST: { label: "Swap Requested" },
  SWAP_ACCEPT: { label: "Swap Accepted" },
  SWAP_REJECT: { label: "Swap Rejected" },
  SWAP_APPROVE: { label: "Swap Approved" },
  SWAP_CANCEL: { label: "Swap Cancelled" },
  SWAP_EXECUTE: { label: "Swap Executed" },
};

export function AuditTrailViewer() {
  const searchParams = useSearchParams();
  const today = new Date();
  const defaultFrom = format(startOfDay(subDays(today, 7)), "yyyy-MM-dd");
  const defaultTo = format(endOfDay(today), "yyyy-MM-dd");

  const [locationId, setLocationId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [shiftId, setShiftId] = useState<string>(
    () => searchParams.get("shiftId") ?? "",
  );

  useEffect(() => {
    const next = searchParams.get("shiftId") ?? "";
    setShiftId(next);
  }, [searchParams]);

  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ["audit", locationId, dateFrom, dateTo, shiftId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (locationId) params.set("locationId", locationId);
      params.set("dateFrom", dateFrom);
      params.set("dateTo", dateTo);
      if (shiftId) params.set("shiftId", shiftId);
      const res = await fetch(`/api/audit?${params}`);
      if (res.status === 403) {
        throw new Error("FORBIDDEN");
      }
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json() as Promise<AuditResponse>;
    },
  });

  const entries = data?.entries ?? [];
  const locations: { id: string; name: string }[] =
    locationsData?.locations ?? [];
  const isForbidden = isError && (error as Error)?.message === "FORBIDDEN";

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      filters: { locationId: locationId || null, dateFrom, dateTo },
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${dateFrom}-${dateTo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isForbidden) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
          <ShieldAlert className="text-muted-foreground size-12" />
          <div className="text-center">
            <h3 className="font-semibold">Admin access required</h3>
            <p className="text-muted-foreground text-sm">
              Admin or Manager access required to view the audit trail.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Audit Trail</h2>
          <p className="text-muted-foreground text-sm">
            View all changes with actor, entity, before/after, and timestamp
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Select
              value={locationId || "all"}
              onValueChange={(v) => setLocationId(v === "all" ? "" : v)}
            >
              <SelectTrigger
                id="location"
                className="w-full min-w-0 sm:w-[200px]"
              >
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateFrom">From</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full min-w-0 sm:w-[160px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">To</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full min-w-0 sm:w-[160px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shiftId">Shift ID</Label>
            <Input
              id="shiftId"
              type="text"
              placeholder="Filter by shift"
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              className="w-full min-w-0 sm:w-[180px] font-mono text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 size-4" />
            Export JSON
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              Loading...
            </p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              No audit entries for the selected filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="min-w-[120px]">
                      Before / After
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(entry.timestamp), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {entry.actorName ??
                            entry.actorEmail ??
                            entry.actorId ??
                            "—"}
                        </div>
                        {entry.actorEmail && (
                          <div className="text-muted-foreground text-xs">
                            {entry.actorEmail}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          action={
                            entry.action in ACTION_CONFIG
                              ? (entry.action as AuditLogAction)
                              : undefined
                          }
                        >
                          {entry.action in ACTION_CONFIG
                            ? ACTION_CONFIG[entry.action as AuditLogAction]
                                .label
                            : entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-xs">
                          {entry.entityType}
                        </span>
                        <span className="ml-1 font-mono text-xs">
                          {entry.entityId.slice(0, 8)}…
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {entry.locationName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ExpandableJson
                          before={entry.before}
                          after={entry.after}
                          changes={entry.changes}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
