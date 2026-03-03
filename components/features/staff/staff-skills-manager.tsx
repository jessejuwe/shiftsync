"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  StaffCard,
  type StaffMember,
  type Skill,
  type Location,
} from "./staff-card";
import { getQueryClient } from "@/app/get-query-client";

export function StaffManager() {
  const queryClient = getQueryClient();

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["staff", "includeExpired"],
    queryFn: async () => {
      const res = await fetch("/api/staff?includeExpired=1");
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });

  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error("Failed to fetch locations");
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
    mutationFn: async ({
      userId,
      skillId,
    }: {
      userId: string;
      skillId: string;
    }) => {
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
      toast.error(
        err instanceof Error ? err.message : "Failed to remove skill",
      );
    },
  });

  const certifyMutation = useMutation({
    mutationFn: async ({
      userId,
      locationId,
    }: {
      userId: string;
      locationId: string;
    }) => {
      const res = await fetch(`/api/staff/${userId}/certifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to certify");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff certified at location");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to certify");
    },
  });

  const decertifyMutation = useMutation({
    mutationFn: async ({
      userId,
      certificationId,
    }: {
      userId: string;
      certificationId: string;
    }) => {
      const res = await fetch(
        `/api/staff/${userId}/certifications/${certificationId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to de-certify");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff de-certified from location");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to de-certify");
    },
  });

  const staff: StaffMember[] = staffData?.staff ?? [];
  const locations: Location[] = locationsData?.locations ?? [];
  const skills: Skill[] = skillsData?.skills ?? [];

  if (staffLoading) {
    return <p className="text-muted-foreground text-sm">Loading staff…</p>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold sm:text-2xl">Staff</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Manage skills and location certifications for each staff member.
          Skills determine shift eligibility; certifications determine which
          locations they can work at.
        </p>
      </div>

      <div className="space-y-4">
        {staff.map((s) => (
          <StaffCard
            key={s.id}
            staff={s}
            skills={skills}
            locations={locations}
            onAddSkill={(skillId) =>
              addMutation.mutate({ userId: s.id, skillId })
            }
            onRemoveSkill={(skillId) =>
              removeMutation.mutate({ userId: s.id, skillId })
            }
            onCertify={(locationId) =>
              certifyMutation.mutate({ userId: s.id, locationId })
            }
            onDecertify={(certificationId) =>
              decertifyMutation.mutate({ userId: s.id, certificationId })
            }
            isAddingSkill={addMutation.isPending}
            isRemovingSkill={removeMutation.isPending}
            isCertifying={certifyMutation.isPending}
            isDecertifying={decertifyMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
