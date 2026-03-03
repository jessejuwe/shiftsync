"use client";

import { Send, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { canUnpublishOrEdit, SCHEDULE_CONFIG } from "@/config/schedule";
import type { Shift } from "./types";

interface SchedulePublishBarProps {
  shiftsByLocation: Array<{
    location: { id: string; name: string };
    shifts: Shift[];
  }>;
  onPublish: (locationId: string, shiftIds: string[]) => void;
  onUnpublish: (locationId: string, shiftIds: string[]) => void;
  isPublishPending: boolean;
  isUnpublishPending: boolean;
}

export function SchedulePublishBar({
  shiftsByLocation,
  onPublish,
  onUnpublish,
  isPublishPending,
  isUnpublishPending,
}: SchedulePublishBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
      <span className="text-muted-foreground text-sm font-medium">
        Schedule:
      </span>
      {shiftsByLocation.map(({ location, shifts: locShifts }) => {
        const unpublished = locShifts.filter((s) => !s.isPublished);
        const published = locShifts.filter((s) => s.isPublished);
        const publishedPastCutoff = published.filter(
          (s) => !canUnpublishOrEdit(new Date(s.startsAt))
        );
        const canUnpublish =
          published.length > 0 && publishedPastCutoff.length === 0;

        return (
          <div
            key={location.id}
            className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5"
          >
            <span className="text-sm font-medium">{location.name}</span>
            {unpublished.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() =>
                      onPublish(location.id, unpublished.map((s) => s.id))
                    }
                    disabled={isPublishPending}
                  >
                    <Send className="size-3.5" />
                    Publish
                    {unpublished.length < locShifts.length &&
                      ` (${unpublished.length})`}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Make schedule visible to staff</TooltipContent>
              </Tooltip>
            )}
            {published.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onUnpublish(location.id, published.map((s) => s.id))
                      }
                      disabled={!canUnpublish || isUnpublishPending}
                    >
                      <EyeOff className="size-3.5" />
                      Unpublish
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {canUnpublish
                    ? "Hide schedule from staff"
                    : `Unpublish blocked: within ${SCHEDULE_CONFIG.unpublishEditCutoffHours}h of shift start`}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      })}
    </div>
  );
}
