"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Mail, Settings2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getQueryClient } from "@/app/get-query-client";

type NotificationPreference = "IN_APP_ONLY" | "IN_APP_AND_EMAIL";

export function NotificationPreferencesForm() {
  const queryClient = getQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings", "notifications"],
    queryFn: async () => {
      const res = await fetch("/api/settings/notifications");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (preference: NotificationPreference) => {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPreference: preference }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message ?? "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["settings", "notifications"],
      });
      toast.success("Notification preferences updated");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const value = (data?.notificationPreference ??
    "IN_APP_ONLY") as NotificationPreference;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-5" />
          Notification preferences
        </CardTitle>
        <CardDescription>
          Choose how you want to receive notifications. In-app notifications
          always appear in the notification center.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : (
          <RadioGroup
            value={value}
            onValueChange={(v) =>
              updateMutation.mutate(v as NotificationPreference)
            }
            className="grid gap-4"
            disabled={updateMutation.isPending}
          >
            <div className="flex items-center space-x-3 rounded-lg border p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5">
              <RadioGroupItem value="IN_APP_ONLY" id="in-app-only" />
              <Label
                htmlFor="in-app-only"
                className="flex flex-1 cursor-pointer items-center gap-3"
              >
                <Bell className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">In-app only</p>
                  <p className="text-muted-foreground text-sm">
                    Notifications appear in the notification center only.
                  </p>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 rounded-lg border p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5">
              <RadioGroupItem value="IN_APP_AND_EMAIL" id="in-app-email" />
              <Label
                htmlFor="in-app-email"
                className="flex flex-1 cursor-pointer items-center gap-3"
              >
                <Mail className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">In-app + email</p>
                  <p className="text-muted-foreground text-sm">
                    Notifications in the app and an email copy (simulated for
                    now).
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
}
