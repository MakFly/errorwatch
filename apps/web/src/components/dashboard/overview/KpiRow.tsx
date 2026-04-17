"use client";

import {
  Activity,
  Zap,
  Bug,
  Shield,
  TrendingUp,
  Database,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import type { PerformanceDateRange } from "@/server/api";
import { KpiCard } from "./KpiCard";

interface KpiRowProps {
  projectId: string;
  dateRange: PerformanceDateRange;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function KpiRow({ projectId, dateRange }: KpiRowProps) {
  const t = useTranslations("dashboard.kpi");
  const serverStats = trpc.performance.getServerStats.useQuery({
    projectId,
    dateRange,
  });
  const duration = trpc.performance.getDurationTimeline.useQuery({
    projectId,
    dateRange,
  });
  const dashStats = trpc.stats.getDashboardStats.useQuery({ projectId });

  // errorRate is a percentage (e.g., 2.5 for 2.5%)
  const uptimePct =
    serverStats.data !== undefined
      ? Math.max(0, 100 - serverStats.data.errorRate)
      : undefined;

  const latencyP95 =
    duration.data && duration.data.length > 0
      ? duration.data[duration.data.length - 1].p95
      : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        label={t("requests")}
        icon={Activity}
        loading={serverStats.isLoading}
        value={
          serverStats.data
            ? formatNumber(serverStats.data.totalTransactions)
            : "—"
        }
      />
      <KpiCard
        label={t("latencyP95")}
        icon={Zap}
        loading={duration.isLoading}
        value={latencyP95 !== undefined ? formatMs(latencyP95) : "—"}
      />
      <KpiCard
        label={t("newIssues24h")}
        icon={Bug}
        loading={dashStats.isLoading}
        value={
          dashStats.data ? formatNumber(dashStats.data.newIssues24h) : "—"
        }
      />
      <KpiCard
        label={t("exceptions")}
        icon={TrendingUp}
        loading={dashStats.isLoading}
        value={
          dashStats.data ? formatNumber(dashStats.data.todayEvents) : "—"
        }
      />
      <KpiCard
        label={t("uptime")}
        icon={Shield}
        loading={serverStats.isLoading}
        value={uptimePct !== undefined ? `${uptimePct.toFixed(2)}%` : "—"}
      />
      <KpiCard
        label={t("events")}
        icon={Database}
        loading={dashStats.isLoading}
        value={
          dashStats.data ? formatNumber(dashStats.data.totalEvents) : "—"
        }
      />
    </div>
  );
}
