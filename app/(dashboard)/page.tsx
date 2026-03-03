import { OvertimeDashboard } from "@/components/features/overtime/overtime-dashboard";
import { FairnessDashboard } from "@/components/features/fairness/fairness-dashboard";
import { OnDutyDashboard } from "@/components/features/shifts/on-duty-dashboard";

export default function DashboardPage() {
  return (
    <div className="space-y-12">
      <OnDutyDashboard />
      <OvertimeDashboard />
      <FairnessDashboard />
    </div>
  );
}
