import { OvertimeDashboard } from "@/components/features/overtime/overtime-dashboard";
import { FairnessDashboard } from "@/components/features/fairness/fairness-dashboard";

export default function DashboardPage() {
  return (
    <div className="space-y-12">
      <OvertimeDashboard />
      <FairnessDashboard />
    </div>
  );
}
