"use client";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

import { QueryProvider } from "./query-provider";
import { RealtimeNotificationsProvider } from "./realtime-notifications-provider";
import { Toaster } from "../ui/sonner";
import { TooltipProvider } from "../ui/tooltip";

/**
 * Provides the application with the necessary providers.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RealtimeNotificationsProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
            <ReactQueryDevtools initialIsOpen={false} />
          </RealtimeNotificationsProvider>
        </ThemeProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
