"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bug,
  BarChart3,
  Gauge,
  Settings,
  Film,
  HelpCircle,
  Zap,
  LayoutDashboard,
  Wrench,
  Terminal,
  Clock,
  Server,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { ProjectSelector } from "@/components/ProjectSelector";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useCurrentOrganization } from "@/contexts/OrganizationContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc/client";
import { useSSEStatus } from "@/components/sse-provider";

export function ErrorWatchSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("navigation");
  const { currentOrgSlug } = useCurrentOrganization();
  const { currentProjectSlug } = useCurrentProject();
  const { data: session, isLoading: sessionLoading } = trpc.auth.getSession.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const pathname = usePathname();
  const sseStatus = useSSEStatus();

  const baseUrl = currentOrgSlug && currentProjectSlug
    ? `/dashboard/${currentOrgSlug}/${currentProjectSlug}`
    : null;

  // Build navigation items based on current org AND project
  const navMain = React.useMemo(() => {
    if (!currentOrgSlug) {
      return [
        {
          title: t("dashboard"),
          url: "/dashboard",
          icon: LayoutDashboard,
          isActive: pathname === "/dashboard",
        },
      ];
    }

    // If no project selected, point to org-level (will show empty state)
    if (!baseUrl) {
      const orgUrl = `/dashboard/${currentOrgSlug}`;
      return [
        {
          title: t("dashboard"),
          url: orgUrl,
          icon: LayoutDashboard,
          isActive: pathname === orgUrl,
        },
      ];
    }

    return [
      {
        title: t("dashboard"),
        url: baseUrl,
        icon: LayoutDashboard,
        isActive: pathname === baseUrl,
      },
      {
        title: t("issues"),
        url: `${baseUrl}/issues`,
        icon: Bug,
        isActive: pathname.startsWith(`${baseUrl}/issues`),
      },
      {
        title: t("logs"),
        url: `${baseUrl}/logs`,
        icon: Terminal,
        isActive: pathname.startsWith(`${baseUrl}/logs`),
      },
      {
        title: t("replays"),
        url: `${baseUrl}/replays`,
        icon: Film,
        isActive: pathname.startsWith(`${baseUrl}/replays`),
      },
      {
        title: t("stats"),
        url: `${baseUrl}/stats`,
        icon: BarChart3,
        isActive: pathname.startsWith(`${baseUrl}/stats`),
      },
      {
        title: t("performance"),
        url: `${baseUrl}/performance`,
        icon: Gauge,
        isActive: pathname.startsWith(`${baseUrl}/performance`),
        children: [
          { title: t("overview"), url: `${baseUrl}/performance`, isActive: pathname === `${baseUrl}/performance` },
          { title: t("requests"), url: `${baseUrl}/performance/requests`, isActive: pathname.startsWith(`${baseUrl}/performance/requests`) },
          { title: t("transactions"), url: `${baseUrl}/performance/transactions`, isActive: pathname.startsWith(`${baseUrl}/performance/transactions`) },
          { title: t("database"), url: `${baseUrl}/performance/database`, isActive: pathname === `${baseUrl}/performance/database` },
          { title: t("cache"), url: `${baseUrl}/performance/cache`, isActive: pathname === `${baseUrl}/performance/cache` },
          { title: t("http"), url: `${baseUrl}/performance/http`, isActive: pathname === `${baseUrl}/performance/http` },
          { title: t("queues"), url: `${baseUrl}/performance/queues`, isActive: pathname === `${baseUrl}/performance/queues` },
          { title: t("webVitals"), url: `${baseUrl}/performance/web-vitals`, isActive: pathname === `${baseUrl}/performance/web-vitals` },
        ],
      },
      {
        title: t("infrastructure"),
        url: `${baseUrl}/infrastructure`,
        icon: Server,
        isActive: pathname.startsWith(`${baseUrl}/infrastructure`),
      },
      {
        title: t("crons"),
        url: `${baseUrl}/crons`,
        icon: Clock,
        isActive: pathname.startsWith(`${baseUrl}/crons`),
      },
    ];
  }, [currentOrgSlug, baseUrl, pathname, t]);

  const isDev = process.env.NODE_ENV !== "production";

  const navSecondary = React.useMemo(() => {
    // Settings and Help require project context
    if (!baseUrl) {
      return [];
    }
    const items = [
      {
        title: t("settings"),
        url: `${baseUrl}/settings`,
        icon: Settings,
      },
      {
        title: t("help"),
        url: `${baseUrl}/help`,
        icon: HelpCircle,
      },
    ];

    if (isDev) {
      items.push({
        title: t("admin"),
        url: `${baseUrl}/admin`,
        icon: Wrench,
      });
    }

    return items;
  }, [baseUrl, isDev, t]);

  const user = React.useMemo(
    () => ({
      name: session?.user?.name ?? null,
      email: session?.user?.email ?? "",
      image: session?.user?.image ?? null,
    }),
    [session]
  );

  const loading = sessionLoading || !session?.user;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5 hover:bg-transparent active:bg-transparent"
            >
              <Link href="/dashboard">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 shadow-lg shadow-violet-600/25">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-tight">
                    ErrorWatch
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t("monitoring")}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Organization & Project Selectors */}
        <div className="space-y-1 px-2 py-2">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("organization")}
          </p>
          <OrganizationSwitcher />
        </div>

        <div className="space-y-1 px-2 pb-2">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("project")}
          </p>
          <ProjectSelector />
        </div>

        <SidebarSeparator />

        <NavMain items={navMain} />

        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        {/* Language Switcher */}
        <div className="px-2 pb-1">
          <LocaleSwitcher />
        </div>

        {/* Live Status */}
        <div className="px-2 pb-2">
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
            sseStatus === "connected"
              ? "bg-emerald-500/10"
              : sseStatus === "connecting"
                ? "bg-amber-500/10"
                : "bg-muted/50"
          }`}>
            <span className="relative flex h-2 w-2">
              {sseStatus === "connected" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${
                sseStatus === "connected"
                  ? "bg-emerald-500"
                  : sseStatus === "connecting"
                    ? "bg-amber-500"
                    : "bg-muted-foreground"
              }`} />
            </span>
            <span className={`text-xs font-medium ${
              sseStatus === "connected"
                ? "text-emerald-400"
                : sseStatus === "connecting"
                  ? "text-amber-400"
                  : "text-muted-foreground"
            }`}>
              {sseStatus === "connected"
                ? t("live")
                : sseStatus === "connecting"
                  ? t("reconnecting")
                  : t("offline")}
            </span>
          </div>
        </div>

        <NavUser user={user} loading={loading} />
      </SidebarFooter>
    </Sidebar>
  );
}
