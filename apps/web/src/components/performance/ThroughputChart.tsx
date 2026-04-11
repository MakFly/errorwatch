"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ThroughputChartProps {
  data: Array<{ bucket: string; count: number; errorCount: number }>;
  isLoading?: boolean;
  dateRange: string;
}

const chartConfig = {
  count: {
    label: "Requests",
    color: "hsl(var(--primary))",
  },
  errorCount: {
    label: "Errors",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig;

function formatBucket(bucket: string, dateRange: string): string {
  if (dateRange === "24h") {
    // Show time "14:00"
    return bucket.slice(11, 16);
  }
  const d = new Date(bucket);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ThroughputChart({ data, isLoading, dateRange }: ThroughputChartProps) {
  // TODO: i18n — "Throughput"
  const title = "Throughput";

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillThroughputCount" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="fillThroughputErrors" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--destructive))"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--destructive))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(v) => formatBucket(v, dateRange)}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => formatBucket(value, dateRange)}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#fillThroughputCount)"
                />
                <Area
                  type="monotone"
                  dataKey="errorCount"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  fill="url(#fillThroughputErrors)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Requests</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
            <span className="text-xs text-muted-foreground">Errors</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
