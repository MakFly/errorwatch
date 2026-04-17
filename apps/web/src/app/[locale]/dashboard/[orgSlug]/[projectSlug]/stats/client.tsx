"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import {
  HeroChart,
  InsightCard,
  DistributionChart,
  ResolutionMetrics,
} from "@/components/stats";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { trpc } from "@/lib/trpc/client";
import type {
  DashboardStats,
  TimelinePoint,
  EnvBreakdown,
  TimelineRange,
} from "@/server/api";
import type { StatsInsight } from "@/server/trpc/router";

interface StatsPageClientProps {
  projectId: string;
  initialStats: DashboardStats;
  initialTimeline: TimelinePoint[];
  initialEnvBreakdown: EnvBreakdown[];
  initialInsights: StatsInsight[];
}

export function StatsPageClient({
  projectId,
  initialStats,
  initialTimeline,
  initialEnvBreakdown,
  initialInsights,
}: StatsPageClientProps) {
  const t = useTranslations("stats.insights");
  const tHeader = useTranslations("pageHeader.stats");
  const [range, setRange] = useState<TimelineRange>("30d");

  // Fetch timeline data when range changes
  const { data: timeline } = trpc.stats.getTimeline.useQuery(
    { range, projectId },
    { initialData: range === "30d" ? initialTimeline : undefined }
  );

  const chartData = timeline || initialTimeline;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PageHeader
        title={tHeader("title")}
        description={tHeader("description")}
        dateRange={range}
        onDateRangeChange={(r) => setRange(r as TimelineRange)}
        rangeOptions={["24h", "7d", "30d"]}
      >
        <button
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => {
            // TODO: implement stats export
          }}
        >
          <Download className="h-4 w-4" />
        </button>
      </PageHeader>

      {/* Hero Chart */}
      <HeroChart data={chartData} range={range} className="mb-4" />

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column - Charts */}
        <div className="space-y-6 lg:col-span-2">
          <DistributionChart data={initialEnvBreakdown} />
        </div>

        {/* Right column - Insights */}
        <div className="space-y-4">
          <div className="mb-4">
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
              {t("sectionTitle")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("sectionSubtitle")}
            </p>
          </div>

          {initialInsights.map((insight, idx) => (
            <InsightCard
              key={idx}
              icon={insight.icon}
              title={t(insight.title as Parameters<typeof t>[0])}
              message={t(insight.message as Parameters<typeof t>[0], insight.params)}
              value={insight.value}
              sentiment={insight.sentiment}
            />
          ))}
        </div>
      </div>

      {/* Resolution Metrics */}
      <ResolutionMetrics stats={initialStats} />
    </div>
  );
}
