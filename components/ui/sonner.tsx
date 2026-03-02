"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--success)",
          "--success-text": "var(--primary-foreground)",
          "--success-border": "var(--border)",
          "--info-bg": "var(--info)",
          "--info-text": "var(--primary-foreground)",
          "--info-border": "var(--border)",
          "--error-bg": "var(--destructive)",
          "--error-text": "var(--primary-foreground)",
          "--error-border": "var(--border)",
          "--warning-bg": "var(--warning)",
          "--warning-text": "var(--primary-foreground)",
          "--warning-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          success:
            "!bg-success !text-primary-foreground [&_svg]:!text-primary-foreground [&_*]:!text-primary-foreground",
          error:
            "!bg-destructive !text-primary-foreground [&_svg]:!text-primary-foreground [&_*]:!text-primary-foreground",
          warning:
            "!bg-warning !text-primary-foreground [&_svg]:!text-primary-foreground [&_*]:!text-primary-foreground",
          info: "!bg-info !text-primary-foreground [&_svg]:!text-primary-foreground [&_*]:!text-primary-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
