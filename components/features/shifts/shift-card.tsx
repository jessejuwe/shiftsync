"use client";

import { format } from "date-fns";
import {
  X,
  Pencil,
  ArrowLeftRight,
  Gift,
  UserPlus,
  LogIn,
  LogOut,
  Send,
  EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { canUnpublishOrEdit, SCHEDULE_CONFIG } from "@/config/schedule";
import type { Shift } from "./types";

export interface ShiftCardActions {
  onEdit: (shift: Shift) => void;
  onAssignStaff: (shift: Shift) => void;
  onUnassign: (assignmentId: string) => void;
  onPublish: (locationId: string, shiftIds: string[]) => void;
  onUnpublish: (locationId: string, shiftIds: string[]) => void;
  onClockIn: (assignmentId: string) => void;
  onClockOut: (assignmentId: string) => void;
  onRequestSwap: (
    assignmentId: string,
    userId: string,
    user: { id: string; name: string; email: string },
    shiftId: string,
  ) => void;
  onOfferUp: (assignmentId: string) => void;
  onPickup: (shift: Shift) => void;
  isUnassignPending: boolean;
  isPublishPending: boolean;
  isUnpublishPending: boolean;
  isClockInPending: boolean;
  isClockOutPending: boolean;
}

interface ShiftCardProps {
  shift: Shift;
  canManage: boolean;
  isStaff: boolean;
  currentUserId: string | null;
  actions: ShiftCardActions;
}

export function ShiftCard({
  shift,
  canManage,
  isStaff,
  currentUserId,
  actions,
}: ShiftCardProps) {
  const now = new Date();
  const endsAt = new Date(shift.endsAt);
  const isPast = endsAt < now;
  const headcount = shift.headcount ?? 1;
  const isFull = shift.assignments.length >= headcount;

  return (
    <Card
      className={`flex flex-col overflow-hidden transition-shadow hover:shadow-md ${
        isPast ? "border-border/40 bg-muted/20" : ""
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {format(new Date(shift.startsAt), "MMM d, HH:mm")} –{" "}
              {format(new Date(shift.endsAt), "HH:mm")}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {shift.location.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            {isPast && (
              <Badge
                variant="outline"
                className="shrink-0 text-muted-foreground"
              >
                Past
              </Badge>
            )}
            {shift.isPublished ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    status="published"
                    className="shrink-0 cursor-help bg-success/20 text-success"
                  >
                    Published
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Visible to staff</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge status="draft" className="shrink-0 cursor-help">
                    Draft
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Not yet visible to staff</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-1 flex-col gap-3">
          {shift.requiredSkills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {shift.requiredSkills.map((s) => (
                <Badge key={s.id} tag="skill">
                  {s.name}
                </Badge>
              ))}
            </div>
          )}
          {(headcount > 1 || shift.assignments.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-muted-foreground shrink-0">
                Assigned: {shift.assignments.length}/{headcount}
              </span>
              {shift.assignments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 bg-muted/60 border border-border/50"
                >
                  {a.user.name}
                  {canManage && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => actions.onUnassign(a.id)}
                          disabled={actions.isUnassignPending}
                          className="ml-0.5 rounded p-0.5 hover:bg-destructive/20 hover:text-destructive disabled:opacity-50"
                          aria-label={`Unassign ${a.user.name}`}
                        >
                          <X className="size-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Unassign {a.user.name}</TooltipContent>
                    </Tooltip>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          {canManage && (
            <>
              {!shift.isPublished && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() =>
                        actions.onPublish(shift.locationId, [shift.id])
                      }
                      disabled={actions.isPublishPending}
                    >
                      <Send className="size-3.5" />
                      Publish
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Make this shift visible to staff
                  </TooltipContent>
                </Tooltip>
              )}
              {shift.isPublished && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          actions.onUnpublish(shift.locationId, [shift.id])
                        }
                        disabled={
                          !canUnpublishOrEdit(new Date(shift.startsAt)) ||
                          actions.isUnpublishPending
                        }
                      >
                        <EyeOff className="size-3.5" />
                        Unpublish
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canUnpublishOrEdit(new Date(shift.startsAt))
                      ? "Hide this shift from staff"
                      : `Unpublish blocked: within ${SCHEDULE_CONFIG.unpublishEditCutoffHours}h of shift start`}
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => actions.onEdit(shift)}
                      disabled={!canUnpublishOrEdit(new Date(shift.startsAt))}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {canUnpublishOrEdit(new Date(shift.startsAt))
                    ? "Edit shift time, title, or required skills"
                    : "Cannot edit within 48 hours of shift start"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => actions.onAssignStaff(shift)}
                      disabled={isFull}
                    >
                      Assign staff
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {isFull ? "Shift is full" : "Assign staff to this shift"}
                </TooltipContent>
              </Tooltip>
            </>
          )}
          {isStaff && currentUserId && (
            <>
              {shift.assignments.some((a) => a.userId === currentUserId) && (
                <>
                  {(() => {
                    const myAssignment = shift.assignments.find(
                      (a) => a.userId === currentUserId,
                    )!;
                    const startsAt = new Date(shift.startsAt);
                    const windowStart = new Date(startsAt);
                    windowStart.setMinutes(windowStart.getMinutes() - 15);
                    const canClockIn =
                      !isPast &&
                      shift.isPublished &&
                      !myAssignment.clockedInAt &&
                      !myAssignment.clockedOutAt &&
                      now >= windowStart &&
                      now <= endsAt;
                    const canClockOut =
                      !isPast &&
                      !!myAssignment.clockedInAt &&
                      !myAssignment.clockedOutAt;
                    return (
                      <>
                        {canClockIn && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() =>
                                  actions.onClockIn(myAssignment.id)
                                }
                                disabled={actions.isClockInPending}
                              >
                                <LogIn className="size-3.5" />
                                Clock in
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Clock in to this shift
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canClockOut && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  actions.onClockOut(myAssignment.id)
                                }
                                disabled={actions.isClockOutPending}
                              >
                                <LogOut className="size-3.5" />
                                Clock out
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Clock out from this shift
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </>
                    );
                  })()}
                  {!isPast && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const a = shift.assignments.find(
                                (x) => x.userId === currentUserId,
                              )!;
                              actions.onRequestSwap(
                                a.id,
                                a.userId,
                                a.user,
                                shift.id,
                              );
                            }}
                          >
                            <ArrowLeftRight className="size-3.5" />
                            Request swap
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Request swap with another staff member
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              actions.onOfferUp(
                                shift.assignments.find(
                                  (a) => a.userId === currentUserId,
                                )!.id,
                              )
                            }
                            disabled={actions.isUnassignPending}
                          >
                            <Gift className="size-3.5" />
                            Offer up
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Offer this shift to another staff member
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </>
              )}
              {!shift.assignments.some((a) => a.userId === currentUserId) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => actions.onPickup(shift)}
                        disabled={isPast || isFull}
                      >
                        <UserPlus className="size-3.5" />
                        Pick up
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPast
                      ? "This shift has ended"
                      : isFull
                        ? "This shift is full"
                        : "Pick up this available shift"}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
