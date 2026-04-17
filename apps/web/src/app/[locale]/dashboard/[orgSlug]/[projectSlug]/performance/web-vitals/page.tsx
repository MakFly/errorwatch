"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { cn } from "@/lib/utils";
import type { PerformanceDateRange, WebVitalMetric, WebVitalRating } from "@/server/api/types";

const VITALS_ORDER = ["LCP", "CLS", "INP", "FCP", "FID", "TTFB"] as const;

const DESCRIPTIONS: Record<string, string> = {
  LCP: "Largest Contentful Paint — loading perception",
  CLS: "Cumulative Layout Shift — visual stability",
  INP: "Interaction to Next Paint — responsiveness",
  FCP: "First Contentful Paint — first render",
  FID: "First Input Delay — legacy responsiveness",
  TTFB: "Time to First Byte — server response",
};

function formatValue(name: string, ms: number): string {
  if (name === "CLS") {
    // Stored as CLS * 1000
    return (ms / 1000).toFixed(3);
  }
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function ratingCls(rating: WebVitalRating): string {
  switch (rating) {
    case "good":
      return "text-status-healthy border-status-healthy/40";
    case "needs-improvement":
      return "text-status-warning border-status-warning/40";
    case "poor":
      return "text-status-critical border-status-critical/40";
    default:
      return "text-muted-foreground border-dashboard-border";
  }
}

function ratingLabel(rating: WebVitalRating): string {
  switch (rating) {
    case "good":
      return "Good";
    case "needs-improvement":
      return "Needs improvement";
    case "poor":
      return "Poor";
    default:
      return "—";
  }
}

export default function WebVitalsPage() {
  const tHeader = useTranslations("pageHeader.performanceWebVitals");
  const { currentProjectId, isLoading: projectLoading } = useCurrentProject();
  const [dateRange, setDateRange] = useState<PerformanceDateRange>("24h");

  const { data, isLoading } = trpc.performance.getWebVitals.useQuery(
    { projectId: currentProjectId!, dateRange },
    { enabled: !!currentProjectId }
  );

  if (projectLoading) return null;

  const metrics = data?.metrics ?? {};
  const totalSamples = data?.totalSamples ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PageHeader
        title={tHeader("title")}
        description={tHeader("description")}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : totalSamples === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dashboard-border bg-dashboard-surface/30 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No Web Vitals captured yet. Install the browser SDK to start reporting.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VITALS_ORDER.map((key) => {
            const metric: WebVitalMetric | undefined = metrics[key];
            return (
              <div
                key={key}
                className={cn(
                  "rounded-xl border bg-dashboard-surface/30 p-5",
                  metric ? ratingCls(metric.rating) : "border-dashboard-border"
                )}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-mono text-sm font-semibold">{key}</h3>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {metric ? ratingLabel(metric.rating) : "No data"}
                  </span>
                </div>
                <p className="mt-3 font-mono text-3xl font-bold tabular-nums">
                  {metric ? formatValue(key, metric.p75) : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  p75 · {metric ? `${metric.count.toLocaleString()} samples` : "no samples"}
                </p>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {DESCRIPTIONS[key]}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
