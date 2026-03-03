import { ShiftsManager } from "@/components/features/shifts/shifts-manager";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shifts",
  description: "Manage your shifts for ShiftSync",
};

export default function ShiftsPage() {
  return (
    <div>
      <ShiftsManager />
    </div>
  );
}
