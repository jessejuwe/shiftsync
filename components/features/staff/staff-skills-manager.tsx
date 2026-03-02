"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { getQueryClient } from "@/app/get-query-client";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: { id: string; name: string }[];
}

interface Skill {
  id: string;
  name: string;
  description: string | null;
}

function StaffSkillCard({
  staff,
  skills,
  onAdd,
  onRemove,
  isAdding,
  isRemoving,
}: {
  staff: StaffMember;
  skills: Skill[];
  onAdd: (skillId: string) => void;
  onRemove: (skillId: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
}) {
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const availableSkills = skills.filter(
    (sk) => !staff.skills.some((us) => us.id === sk.id)
  );

  const handleAdd = () => {
    if (selectedSkillId) {
      onAdd(selectedSkillId);
      setSelectedSkillId("");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{staff.name}</CardTitle>
            <p className="text-muted-foreground text-sm">{staff.email}</p>
            {staff.role === "MANAGER" && (
              <Badge variant="secondary" className="mt-1">
                Manager
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {staff.skills.map((sk) => (
              <Badge
                key={sk.id}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {sk.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-4 rounded-full hover:bg-destructive/20 hover:text-destructive"
                  onClick={() => onRemove(sk.id)}
                  disabled={isRemoving}
                  aria-label={`Remove ${sk.name}`}
                >
                  <X className="size-3" />
                </Button>
              </Badge>
            ))}
            {availableSkills.length > 0 && (
              <div className="flex items-center gap-1">
                <Select
                  value={selectedSkillId}
                  onValueChange={setSelectedSkillId}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Add skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSkills.map((sk) => (
                      <SelectItem key={sk.id} value={sk.id}>
                        {sk.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleAdd}
                  disabled={!selectedSkillId || isAdding}
                  aria-label="Add skill"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      {staff.skills.length === 0 && availableSkills.length === 0 && (
        <CardContent className="pt-0">
          <p className="text-muted-foreground text-sm">
            No skills assigned. All skills have been added.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

export function StaffSkillsManager() {
  const queryClient = getQueryClient();

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff");
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });

  const { data: skillsData } = useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const res = await fetch("/api/skills");
      if (!res.ok) throw new Error("Failed to fetch skills");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ userId, skillId }: { userId: string; skillId: string }) => {
      const res = await fetch(`/api/staff/${userId}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to add skill");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Skill added");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add skill");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({
      userId,
      skillId,
    }: {
      userId: string;
      skillId: string;
    }) => {
      const res = await fetch(`/api/staff/${userId}/skills/${skillId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to remove skill");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Skill removed");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to remove skill");
    },
  });

  const staff: StaffMember[] = staffData?.staff ?? [];
  const skills: Skill[] = skillsData?.skills ?? [];

  if (staffLoading) {
    return (
      <p className="text-muted-foreground text-sm">Loading staff…</p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Staff Skills</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Manage skills for each staff member. Skills determine who can be
          assigned to shifts that require them.
        </p>
      </div>

      <div className="space-y-4">
        {staff.map((s) => (
          <StaffSkillCard
            key={s.id}
            staff={s}
            skills={skills}
            onAdd={(skillId) => addMutation.mutate({ userId: s.id, skillId })}
            onRemove={(skillId) =>
              removeMutation.mutate({ userId: s.id, skillId })
            }
            isAdding={addMutation.isPending}
            isRemoving={removeMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
