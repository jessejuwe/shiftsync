import { NotificationPreferencesForm } from "@/components/features/settings/notification-preferences-form";
import { MySkillsCard } from "@/components/features/settings/my-skills-card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your ShiftSync settings and preferences",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Configure your notification preferences and other account settings.
        </p>
      </div>
      <MySkillsCard />
      <NotificationPreferencesForm />
    </div>
  );
}
