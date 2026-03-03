import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StaffManager } from "@/components/features/staff/staff-skills-manager";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff",
  description: "Manage staff skills and certifications for ShiftSync",
};

export default async function StaffPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    redirect("/");
  }

  return (
    <div>
      <StaffManager />
    </div>
  );
}
