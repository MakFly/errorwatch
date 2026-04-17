"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { usePerformanceQueries } from "@/hooks/usePerformanceQueries";
import { MetricRibbon } from "@/components/performance/MetricRibbon";
import { ThroughputChart } from "@/components/performance/ThroughputChart";
import { DurationChart } from "@/components/performance/DurationChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  ArrowRight,
  Database,
  Globe,
  HardDrive,
  List,
  ListTree,
  Activity,
  Gauge,
} from "lucide-react";
import type { PerformanceDateRange } from "@/server/api/types";

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export default function PerformancePage() {
  const t = useTranslations("performance");
  const tHeader = useTranslations("pageHeader.performance");
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const projectSlug = params.projectSlug as string;
  const baseUrl = `/dashboard/${orgSlug}/${projectSlug}`;

  const { currentProjectId, currentProject, isLoading: projectLoading } = useCurrentProject();
  const [dateRange, setDateRange] = useState<PerformanceDateRange>("24h");

  const platform = currentProject?.platform ?? "";
  const isServerSide = ["symfony", "laravel", "nodejs", "hono", "fastify"].includes(platform);

  const {
    transactionsData,
    apdexData,
    serverStats,
    throughputTimeline,
    durationTimeline,
  } = usePerformanceQueries(currentProjectId, dateRange, isServerSide);

  if (projectLoading) {
    return null;
  }

  const serverSubPages = [
    {
      title: t("subPages.requests.title"),
      description: t("subPages.requests.description"),
      href: `${baseUrl}/performance/requests`,
      icon: ListTree,
    },
    {
      title: t("subPages.transactions.title"),
      description: t("subPages.transactions.description"),
      href: `${baseUrl}/performance/transactions`,
      icon: List,
    },
    {
      title: t("subPages.database.title"),
      description: t("subPages.database.description"),
      href: `${baseUrl}/performance/database`,
      icon: Database,
    },
    {
      title: t("subPages.cache.title"),
      description: t("subPages.cache.description"),
      href: `${baseUrl}/performance/cache`,
      icon: HardDrive,
    },
    {
      title: t("subPages.http.title"),
      description: t("subPages.http.description"),
      href: `${baseUrl}/performance/http`,
      icon: Globe,
    },
    {
      title: t("subPages.queues.title"),
      description: t("subPages.queues.description"),
      href: `${baseUrl}/performance/queues`,
      icon: Activity,
    },
  ];

  const clientSubPages = [
    {
      title: t("subPages.webVitals.title"),
      description: t("subPages.webVitals.description"),
      href: `${baseUrl}/performance/web-vitals`,
      icon: Gauge,
    },
    {
      title: t("subPages.transactions.title"),
      description: t("subPages.transactions.description"),
      href: `${baseUrl}/performance/transactions`,
      icon: List,
    },
  ];

  const subPages = isServerSide ? serverSubPages : clientSubPages;

  const ribbonMetrics = serverStats.data
    ? [
        {
          label: t("throughputLabel"),
          value: `${serverStats.data.throughput.toFixed(1)}`,
          sub: t("throughputUnit"),
        },
        {
          label: "p95 latency",
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
          label: "Apdex",
          value: apdexData.data ? apdexData.data.score.toFixed(2) : "—",
          sub: apdexData.data
            ? `${apdexData.data.satisfied} satisfied`
            : undefined,
        },
        {
          label: "Transactions",
          value: serverStats.data.totalTransactions.toLocaleString(),
        },
      ]
    : [];

  const hasTransactions =
    transactionsData.data && transactionsData.data.transactions.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PageHeader
        title={tHeader("title")}
        description={tHeader("description")}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {isServerSide && (
        <>
          {!hasTransactions && !serverStats.isLoading && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No transactions recorded yet. Install an SDK to start tracking performance.
              </p>
            </div>
          )}

          <MetricRibbon
            metrics={ribbonMetrics}
            isLoading={serverStats.isLoading || apdexData.isLoading}
          />
        </>
      )}

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
