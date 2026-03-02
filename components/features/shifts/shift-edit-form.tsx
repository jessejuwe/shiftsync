"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const shiftEditSchema = z.object({
  locationId: z.string().min(1, "Location is required"),
  startsAt: z.string().min(1, "Start time is required"),
  endsAt: z.string().min(1, "End time is required"),
  title: z.string().optional(),
  notes: z.string().optional(),
  headcount: z.coerce.number().int().min(1, "At least 1").default(1),
  requiredSkillIds: z.array(z.string()).optional(),
});

export type ShiftEditFormValues = z.infer<typeof shiftEditSchema>;

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
}

interface Skill {
  id: string;
  name: string;
  description: string | null;
}

interface ShiftForEdit {
  id: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  title: string | null;
  notes: string | null;
  headcount?: number;
  requiredSkills: { id: string; name: string }[];
}

interface ShiftEditFormProps {
  shift: ShiftForEdit;
  locations: Location[];
  skills: Skill[];
  onSubmit: (values: ShiftEditFormValues) => Promise<void>;
  onSuccess: () => void;
  isPending?: boolean;
  error?: string | null;
}

export function ShiftEditForm({
  shift,
  locations,
  skills,
  onSubmit,
  onSuccess,
  isPending = false,
  error,
}: ShiftEditFormProps) {
  const form = useForm<ShiftEditFormValues>({
    resolver: zodResolver(shiftEditSchema),
    defaultValues: {
      locationId: shift.locationId,
      startsAt: toDatetimeLocal(shift.startsAt),
      endsAt: toDatetimeLocal(shift.endsAt),
      title: shift.title ?? "",
      notes: shift.notes ?? "",
      headcount: shift.headcount ?? 1,
      requiredSkillIds: shift.requiredSkills.map((s) => s.id),
    },
  });

  useEffect(() => {
    form.reset({
      locationId: shift.locationId,
      startsAt: toDatetimeLocal(shift.startsAt),
      endsAt: toDatetimeLocal(shift.endsAt),
      title: shift.title ?? "",
      notes: shift.notes ?? "",
      headcount: shift.headcount ?? 1,
      requiredSkillIds: shift.requiredSkills.map((s) => s.id),
    });
  }, [shift, form]);

  async function handleSubmit(values: ShiftEditFormValues) {
    const startsAt = new Date(values.startsAt).toISOString();
    const endsAt = new Date(values.endsAt).toISOString();
    await onSubmit({
      ...values,
      startsAt,
      endsAt,
    });
    onSuccess();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-5"
      >
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <FormField
          control={form.control}
          name="locationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Location cannot be changed when editing
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="startsAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start time</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="endsAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>End time</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="headcount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Headcount</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  value={field.value}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v ? Math.max(1, parseInt(v, 10) || 1) : 1);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title (optional)</FormLabel>
              <FormControl>
                <Input placeholder="Shift title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="requiredSkillIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Required skills</FormLabel>
              <div className="flex flex-wrap gap-4 rounded-md border border-border bg-muted/30 p-4">
                {skills.map((skill) => (
                  <label
                    key={skill.id}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Checkbox
                      checked={field.value?.includes(skill.id)}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...(field.value ?? []), skill.id]
                          : (field.value ?? []).filter((id) => id !== skill.id);
                        field.onChange(next);
                      }}
                    />
                    <span className="text-sm font-medium">{skill.name}</span>
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </Form>
  );
}
