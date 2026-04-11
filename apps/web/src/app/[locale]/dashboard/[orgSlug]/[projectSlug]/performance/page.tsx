"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { usePerformanceQueries } from "@/hooks/usePerformanceQueries";
import { ApdexGauge } from "@/components/performance/ApdexGauge";
import { SpanBreakdownOverview, WebVitalsCards } from "@/components/performance";
import { MetricRibbon } from "@/components/performance/MetricRibbon";
import { ThroughputChart } from "@/components/performance/ThroughputChart";
import { DurationChart } from "@/components/performance/DurationChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Database, Globe, List } from "lucide-react";
import type { PerformanceDateRange } from "@/server/api/types";

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export default function PerformancePage() {
  const t = useTranslations("performance");
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const projectSlug = params.projectSlug as string;
  const baseUrl = `/dashboard/${orgSlug}/${projectSlug}`;

  const { currentProjectId, currentProject, isLoading: projectLoading } = useCurrentProject();
  const [dateRange, setDateRange] = useState<PerformanceDateRange>("24h");

  const platform = currentProject?.platform ?? "";
  const isServerSide = ["symfony", "laravel", "nodejs", "hono", "fastify"].includes(platform);

  const {
    webVitals,
    transactionsData,
    spanAnalysis,
    apdexData,
    serverStats,
    throughputTimeline,
    durationTimeline,
  } = usePerformanceQueries(currentProjectId, dateRange, isServerSide);

  const isLoading = projectLoading || (!isServerSide && webVitals.isLoading);

  if (isLoading) {
    return null;
  }

  const subPages = [
    {
      title: t("subPages.transactions.title"),
      description: t("subPages.transactions.description"),
      href: `${baseUrl}/performance/transactions`,
      icon: List,
    },
    {
      title: t("subPages.webVitals.title"),
      description: t("subPages.webVitals.description"),
      href: `${baseUrl}/performance/web-vitals`,
      icon: Globe,
    },
    {
      title: t("subPages.databaseQueries.title"),
      description: t("subPages.databaseQueries.description"),
      href: `${baseUrl}/performance/queries`,
      icon: Database,
    },
  ];

  // Build MetricRibbon metrics from serverStats + apdexData
  const ribbonMetrics = serverStats.data
    ? [
        {
          label: "Throughput", // TODO: i18n
          value: `${serverStats.data.throughput.toFixed(1)}/min`,
          sub: t("throughputUnit"),
        },
        {
          label: "Avg Latency", // TODO: i18n
          value: formatMs(serverStats.data.avgDuration),
        },
        {
          label: t("errorRate"),
          value: `${serverStats.data.errorRate}%`,
          sub:
            serverStats.data.errorRate > 5 ? t("aboveThreshold") : undefined,
          alert: serverStats.data.errorRate > 5,
        },
        {
          label: "Apdex", // TODO: i18n
          value: apdexData.data ? apdexData.data.score.toFixed(2) : "—",
          sub: apdexData.data
            ? `${apdexData.data.satisfied} satisfied`
            : undefined,
        },
        {
          label: "Total", // TODO: i18n
          value: serverStats.data.totalTransactions.toLocaleString(),
          sub: t("transactions.title"),
        },
      ]
    : [];

  const hasTransactions =
    transactionsData.data && transactionsData.data.transactions.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("overview")}</h1>
        <Select
          value={dateRange}
          onValueChange={(v) => setDateRange(v as PerformanceDateRange)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">{t("dateRange.last24h")}</SelectItem>
            <SelectItem value="7d">{t("dateRange.last7d")}</SelectItem>
            <SelectItem value="30d">{t("dateRange.last30d")}</SelectItem>
            <SelectItem value="90d">{t("dateRange.last90d")}</SelectItem>
            <SelectItem value="6m">{t("dateRange.last6m")}</SelectItem>
            <SelectItem value="1y">{t("dateRange.lastYear")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Server-side view */}
      {isServerSide && (
        <>
          {/* Empty state */}
          {!hasTransactions && !serverStats.isLoading && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-sm text-muted-foreground">
                {/* TODO: i18n */}
                No transactions recorded yet. Install an SDK to start tracking performance.
              </p>
            </div>
          )}

          {/* MetricRibbon */}
          <MetricRibbon
            metrics={ribbonMetrics}
            isLoading={serverStats.isLoading || apdexData.isLoading}
          />

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ThroughputChart
              data={throughputTimeline.data ?? []}
              isLoading={throughputTimeline.isLoading}
              dateRange={dateRange}
            />
            <DurationChart
              data={durationTimeline.data ?? []}
              isLoading={durationTimeline.isLoading}
              dateRange={dateRange}
            />
          </div>

          {/* Apdex + SpanBreakdown */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ApdexGauge data={apdexData.data} isLoading={apdexData.isLoading} />
            <SpanBreakdownOverview
              data={spanAnalysis.data?.byOp ?? []}
              isLoading={spanAnalysis.isLoading}
            />
          </div>
        </>
      )}

      {/* Client-side (frontend) view */}
      {!isServerSide && (
        <>
          <WebVitalsCards vitals={webVitals.data || []} />

          {/* Charts row — always show for frontend too */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ThroughputChart
              data={throughputTimeline.data ?? []}
              isLoading={throughputTimeline.isLoading}
              dateRange={dateRange}
            />
            <DurationChart
              data={durationTimeline.data ?? []}
              isLoading={durationTimeline.isLoading}
              dateRange={dateRange}
            />
          </div>
        </>
      )}

      {/* Quick navigation to sub-pages */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {subPages.map((page) => (
          <Link key={page.href} href={page.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <page.icon className="h-4 w-4 text-muted-foreground" />
                  {page.title}
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{page.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
