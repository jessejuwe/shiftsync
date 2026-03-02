import { AvailabilityManager } from "@/components/features/availability/availability-manager";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Availability",
  description: "Manage your availability for ShiftSync",
};

export default function AvailabilityPage() {
  return (
    <div>
      <AvailabilityManager />
    </div>
  );
}
