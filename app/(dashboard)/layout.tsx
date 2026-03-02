"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { CalendarDays, FileText, LayoutDashboard, Clock, LogOut } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "ADMIN";
  const isStaff = role === "STAFF";

  // Redirect staff from dashboard to shifts
  useEffect(() => {
    if (status === "authenticated" && isStaff && pathname === "/") {
      router.replace("/shifts");
    }
  }, [status, isStaff, pathname, router]);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="px-4 py-3 font-semibold text-sidebar-foreground">
            ShiftSync
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarMenu>
              {!isStaff && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/"}>
                    <Link href="/">
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/shifts"}>
                  <Link href="/shifts">
                    <CalendarDays />
                    <span>Shifts</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/availability"}>
                  <Link href="/availability">
                    <Clock />
                    <span>Availability</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/audit"}>
                    <Link href="/audit">
                      <FileText />
                      <span>Audit Trail</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="flex flex-col gap-2 p-2">
            {session?.user?.email && (
              <p className="text-muted-foreground truncate px-2 text-xs">
                {session.user.email}
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="justify-start gap-2"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-1 flex-col p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
