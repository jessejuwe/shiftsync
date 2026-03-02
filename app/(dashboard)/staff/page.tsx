import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StaffSkillsManager } from "@/components/features/staff/staff-skills-manager";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Skills",
  description: "Manage staff skills for ShiftSync",
};

export default async function StaffPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    redirect("/");
  }

  return (
    <div>
      <StaffSkillsManager />
    </div>
  );
}
