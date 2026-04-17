"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import type { PerformanceDateRange } from "@/server/api";

interface LatencyPressureCardProps {
  projectId: string;
  dateRange: PerformanceDateRange;
}

const chartConfig = {
  p95: {
    label: "p95",
    color: "hsl(var(--status-critical))",
  },
  p50: {
    label: "p50",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig;

function formatBucket(bucket: string, range: PerformanceDateRange): string {
  const d = new Date(bucket);
  if (Number.isNaN(d.getTime())) return bucket;
  if (range === "24h") {
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function LatencyPressureCard({
  projectId,
  dateRange,
}: LatencyPressureCardProps) {
  const { data, isLoading } = trpc.performance.getDurationTimeline.useQuery({
    projectId,
    dateRange,
  });

  const buckets = data ?? [];
  const peakP95 = buckets.reduce((max, b) => (b.p95 > max ? b.p95 : max), 0);
  const lastP95 = buckets.length > 0 ? buckets[buckets.length - 1].p95 : 0;

  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-surface/30 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            Latency pressure
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            p95 response time over the selected range
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="font-mono text-lg font-bold tabular-nums text-status-critical">
              {peakP95 > 0 ? formatMs(peakP95) : "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Peak
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-bold tabular-nums text-foreground">
              {lastP95 > 0 ? formatMs(lastP95) : "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Current
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : buckets.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
          No latency data for this period
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={buckets}
              margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillP95" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--status-critical))"
                    stopOpacity={0.5}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--status-critical))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) => formatBucket(v, dateRange)}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={32}
              />
              <YAxis
                tickFormatter={(v: number) => formatMs(v)}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatBucket(String(value), dateRange)}
                    formatter={(value, name) => (
                      <div className="flex w-full justify-between gap-2">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-mono font-medium text-foreground">
                          {formatMs(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="p95"
                stroke="hsl(var(--status-critical))"
                strokeWidth={2}
                fill="url(#fillP95)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </div>
  );
}
