"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/features/notifications/notification-center";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Clock,
  LogOut,
  Settings,
  Users,
} from "lucide-react";

const ROLE_CONFIG: Record<
  string,
  { label: string; badgeRole: "admin" | "manager" | "staff" }
> = {
  ADMIN: { label: "Admin", badgeRole: "admin" },
  MANAGER: { label: "Manager", badgeRole: "manager" },
  STAFF: { label: "Staff", badgeRole: "staff" },
};

function MobileSidebarCloseOnNavigate() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);
  return null;
}

export function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";
  const isStaff = role === "STAFF";
  const canManageStaff = isAdmin || isManager;
  const roleConfig = role ? ROLE_CONFIG[role] : null;

  return (
    <SidebarProvider>
      <MobileSidebarCloseOnNavigate />
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center justify-between gap-2 py-3">
            <Image
              src="/assets/logo.png"
              alt="ShiftSync"
              width={120}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <NotificationCenter />
            </div>
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
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/availability"}
                >
                  <Link href="/availability">
                    <Clock />
                    <span>Availability</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {canManageStaff && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/staff"}>
                    <Link href="/staff">
                      <Users />
                      <span>Staff</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {(isAdmin || isManager) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/audit"}>
                    <Link href="/audit">
                      <FileText />
                      <span>Audit Trail</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/settings"}>
                  <Link href="/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="flex flex-col gap-2 p-2">
            {(session?.user?.email || roleConfig) && (
              <div className="flex flex-wrap items-center gap-2 px-2">
                {roleConfig && (
                  <Badge
                    role={roleConfig.badgeRole}
                    className="shrink-0 text-[10px] font-normal"
                  >
                    {roleConfig.label}
                  </Badge>
                )}
                {session?.user?.email && (
                  <span className="text-muted-foreground min-w-0 truncate text-xs">
                    {session.user.email}
                  </span>
                )}
              </div>
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
        {/* Mobile header: hamburger, logo, actions - visible only when sidebar is in drawer */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:hidden">
          <SidebarTrigger
            className="-ml-2 size-10 touch-manipulation"
            aria-label="Open menu"
          />
          <div className="flex flex-1 items-center justify-center">
            <Image
              src="/assets/logo.png"
              alt="ShiftSync"
              width={100}
              height={28}
              className="h-7 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationCenter />
          </div>
        </header>
        <div className="flex flex-1 flex-col p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
