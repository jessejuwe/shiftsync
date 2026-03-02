"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface SwapRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: {
    id: string;
    userId: string;
    user: { id: string; name: string; email: string };
    shiftId: string;
  } | null;
  shifts: {
    id: string;
    locationId: string;
    assignments: { id: string; userId: string; user: { id: string; name: string } }[];
  }[];
  currentUserId: string;
  onSuccess: () => void;
}

export function SwapRequestModal({
  open,
  onOpenChange,
  assignment,
  shifts,
  currentUserId,
  onSuccess,
}: SwapRequestModalProps) {
  const [receiverId, setReceiverId] = useState<string>("");
  const [receiverShiftId, setReceiverShiftId] = useState<string>("");
  const [message, setMessage] = useState("");

  const shift = assignment
    ? shifts.find((s) => s.id === assignment.shiftId)
    : null;
  const locationId = shift?.locationId ?? null;

  const { data: staffData } = useQuery({
    queryKey: ["staff", locationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (locationId) params.set("locationId", locationId);
      const res = await fetch("/api/staff?" + params);
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
    enabled: open && !!locationId,
  });

  const staff = (staffData?.staff ?? []).filter(
    (s: { id: string }) => s.id !== currentUserId
  );

  const receiverAssignments = receiverId
    ? shifts.flatMap((s) =>
        s.assignments
          .filter((a) => a.userId === receiverId)
          .map((a) => ({ ...a, shift: s }))
      )
    : [];

  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!assignment || !receiverId) throw new Error("Select a staff member");
      const res = await fetch("/api/swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiatorId: currentUserId,
          receiverId,
          initiatorShiftId: assignment.id,
          ...(receiverShiftId && { receiverShiftId }),
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? "Failed to request swap");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Swap request sent");
      onSuccess();
      onOpenChange(false);
      setReceiverId("");
      setReceiverShiftId("");
      setMessage("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to request swap");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    swapMutation.mutate();
  };

  if (!assignment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request swap</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Request to swap your shift with another staff member. You can offer
            your shift to someone (they take yours) or propose a direct swap.
          </p>
          <div className="space-y-2">
            <Label>Staff member</Label>
            <Select
              value={receiverId}
              onValueChange={(v) => {
                setReceiverId(v);
                setReceiverShiftId("");
              }}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select who to swap with" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s: { id: string; name: string; email: string }) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {receiverId && receiverAssignments.length > 0 && (
            <div className="space-y-2">
              <Label>Their shift (optional – for direct swap)</Label>
              <Select
                value={receiverShiftId}
                onValueChange={setReceiverShiftId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None – offer them your shift only" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None – offer them your shift only</SelectItem>
                  {receiverAssignments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {(a.shift as { location?: { name: string }; startsAt?: string }).location?.name ?? "Shift"} –{" "}
                      {format(new Date((a.shift as { startsAt?: string }).startsAt ?? 0), "MMM d, HH:mm")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Family event on Saturday – can we swap?"
              rows={3}
              className="resize-none"
            />
          </div>
          {swapMutation.error && (
            <p className="text-destructive text-sm">
              {swapMutation.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={swapMutation.isPending}>
              {swapMutation.isPending ? "Sending…" : "Request swap"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
