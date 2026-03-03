"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeekNavigatorProps {
  monday: Date;
  sunday: Date;
  weekOffset: number;
  onWeekChange: (delta: number) => void;
  onJumpToToday: () => void;
}

export function WeekNavigator({
  monday,
  sunday,
  weekOffset,
  onWeekChange,
  onJumpToToday,
}: WeekNavigatorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/30">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onWeekChange(-1)}
            className="h-9 w-9"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous week</TooltipContent>
      </Tooltip>
      <span className="min-w-[140px] px-3 py-1.5 text-center text-sm font-medium">
        {format(monday, "MMM d")} – {format(sunday, "MMM d")}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onWeekChange(1)}
            className="h-9 w-9"
          >
            <ChevronRight className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next week</TooltipContent>
      </Tooltip>
      {weekOffset !== 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onJumpToToday}
              className="h-8 text-xs"
            >
              Today
            </Button>
          </TooltipTrigger>
          <TooltipContent>Jump to current week</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
