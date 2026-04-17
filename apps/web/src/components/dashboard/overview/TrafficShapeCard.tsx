"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations, useLocale } from "next-intl";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import type { PerformanceDateRange } from "@/server/api";

interface TrafficShapeCardProps {
  projectId: string;
  dateRange: PerformanceDateRange;
}

function formatBucket(bucket: string, range: PerformanceDateRange, locale: string): string {
  const d = new Date(bucket);
  if (Number.isNaN(d.getTime())) return bucket;
  if (range === "24h") {
    return d.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function TrafficShapeCard({
  projectId,
  dateRange,
}: TrafficShapeCardProps) {
  const t = useTranslations("dashboard.overview.trafficShape");
  const locale = useLocale();
  const chartConfig = {
    count: {
      label: t("legend.requests"),
      color: "hsl(var(--muted-foreground))",
    },
    peak: {
      label: t("legend.peak"),
      color: "hsl(var(--status-warning))",
    },
  } satisfies ChartConfig;

  const { data, isLoading } = trpc.performance.getThroughputTimeline.useQuery({
    projectId,
    dateRange,
  });

  const buckets = data ?? [];
  const totalRequests = buckets.reduce((sum, b) => sum + b.count, 0);
  const maxCount = buckets.reduce((max, b) => (b.count > max ? b.count : max), 0);
  const peakBucket = buckets.find((b) => b.count === maxCount && maxCount > 0);

  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-surface/30 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            {t("title")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
            {totalRequests.toLocaleString()}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("total")}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : buckets.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={buckets}
              margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) => formatBucket(v, dateRange, locale)}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={32}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatBucket(String(value), dateRange, locale)}
                  />
                }
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {buckets.map((b) => (
                  <Cell
                    key={b.bucket}
                    fill={
                      peakBucket && b.bucket === peakBucket.bucket
                        ? "hsl(var(--status-warning))"
                        : "hsl(var(--muted-foreground) / 0.6)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  );
}
