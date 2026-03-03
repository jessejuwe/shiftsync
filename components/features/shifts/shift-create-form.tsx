"use client";

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

const shiftCreateSchema = z.object({
  locationId: z.string().min(1, "Location is required"),
  startsAt: z.string().min(1, "Start time is required"),
  endsAt: z.string().min(1, "End time is required"),
  title: z.string().optional(),
  notes: z.string().optional(),
  headcount: z.coerce.number().int().min(1, "At least 1").default(1),
  requiredSkillIds: z.array(z.string()).optional(),
});

type ShiftCreateFormValues = z.infer<typeof shiftCreateSchema>;

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

interface ShiftCreateFormProps {
  locations: Location[];
  skills: Skill[];
  onSubmit: (values: ShiftCreateFormValues) => Promise<void>;
  onSuccess: () => void;
  isPending?: boolean;
}

export function ShiftCreateForm({
  locations,
  skills,
  onSubmit,
  onSuccess,
  isPending = false,
}: ShiftCreateFormProps) {
  const form = useForm<ShiftCreateFormValues>({
    resolver: zodResolver(shiftCreateSchema),
    defaultValues: {
      locationId: "",
      startsAt: "",
      endsAt: "",
      title: "",
      notes: "",
      headcount: 1,
      requiredSkillIds: [],
    },
  });

  async function handleSubmit(values: ShiftCreateFormValues) {
    await onSubmit(values);
    form.reset();
    onSuccess();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-5"
      >
        <FormField
          control={form.control}
          name="locationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem
                      key={loc.id}
                      value={loc.id}
                    >
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Input
                  type="datetime-local"
                  {...field}
                />
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
                <Input
                  type="datetime-local"
                  {...field}
                />
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
                <Input
                  placeholder="Shift title"
                  {...field}
                />
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
                <Textarea
                  placeholder="Additional notes"
                  {...field}
                />
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
        <Button
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Creating..." : "Create shift"}
        </Button>
      </form>
    </Form>
  );
}
