"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Skill {
  id: string;
  skill: { id: string; name: string };
}

export function MySkillsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["settings", "my-skills"],
    queryFn: async () => {
      const res = await fetch("/api/staff/me/skills");
      if (!res.ok) throw new Error("Failed to fetch skills");
      return res.json() as Promise<{ skills: Skill[] }>;
    },
  });

  const skills = data?.skills ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeCheck className="size-5" />
          My skills
        </CardTitle>
        <CardDescription>
          Skills assigned to you by your manager. You will be notified when
          skills are added or removed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : skills.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No skills assigned yet. Contact your manager to add skills to your
            profile.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((ss) => (
              <Badge key={ss.id} tag="skill" className="font-normal">
                {ss.skill.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
