"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
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
import type { EnvBreakdown } from "@/server/api";

interface DistributionChartProps {
  data: EnvBreakdown[];
  className?: string;
}

const envColors: Record<string, string> = {
  prod: "hsl(0 72% 51%)",
  production: "hsl(0 72% 51%)",
  staging: "hsl(38 92% 50%)",
  dev: "hsl(217 91% 60%)",
  development: "hsl(217 91% 60%)",
  test: "hsl(142 71% 45%)",
  local: "hsl(var(--brand))",
};

export function DistributionChart({ data, className }: DistributionChartProps) {
  const t = useTranslations("stats.distribution");
  const chartConfig: ChartConfig = data.reduce((acc, item) => {
    acc[item.env] = {
      label: item.env.charAt(0).toUpperCase() + item.env.slice(1),
      color: envColors[item.env] || "hsl(var(--primary))",
    };
    return acc;
  }, {} as ChartConfig);

  const chartData = data.map((item) => ({
    name: item.env,
    value: item.count,
    fill: envColors[item.env] || "hsl(var(--primary))",
  }));

  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex h-[300px] items-center justify-center rounded-2xl border bg-card",
          className
        )}
      >
        <p className="text-sm text-muted-foreground">{t("noData")}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-6",
        className
      )}
    >
      <div className="mb-6">
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          {t("title")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <ChartContainer config={chartConfig} className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              width={80}
              tickFormatter={(value) =>
                value.charAt(0).toUpperCase() + value.slice(1)
              }
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              cursor={{ fill: "hsl(var(--accent) / 0.1)" }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Stats below chart */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
        {data.slice(0, 4).map((item) => (
          <div key={item.env} className="text-center">
            <p
              className="font-mono text-lg font-bold"
              style={{ color: envColors[item.env] || "hsl(var(--foreground))" }}
            >
              {Math.round((item.count / total) * 100)}%
            </p>
            <p className="text-xs capitalize text-muted-foreground">
              {item.env}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
