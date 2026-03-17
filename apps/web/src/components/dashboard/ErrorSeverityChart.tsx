"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { SeverityBreakdown } from "@/server/api/types/stats";

const SEVERITY_COLORS: Record<string, string> = {
  fatal: "#dc2626",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  debug: "#6b7280",
};

const SEVERITY_ORDER = ["fatal", "error", "warning", "info", "debug"];

interface ErrorSeverityChartProps {
  data: SeverityBreakdown[];
}

export function ErrorSeverityChart({ data }: ErrorSeverityChartProps) {
  const t = useTranslations("dashboard.errorSeverity");
  const sorted = useMemo(() => {
    return [...data].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.level) - SEVERITY_ORDER.indexOf(b.level)
    );
  }, [data]);

  const total = useMemo(() => sorted.reduce((sum, s) => sum + s.count, 0), [sorted]);

  // Build SVG donut segments
  const segments = useMemo(() => {
    if (total === 0) return [];
    const result: { level: string; color: string; offset: number; pct: number; count: number }[] = [];
    let cumulative = 0;

    for (const item of sorted) {
      const pct = (item.count / total) * 100;
      result.push({
        level: item.level,
        color: SEVERITY_COLORS[item.level] || "#6b7280",
        offset: cumulative,
        pct,
        count: item.count,
      });
      cumulative += pct;
    }

    return result;
  }, [sorted, total]);

  const circumference = 2 * Math.PI * 35;

  if (total === 0) return null;

  return (
    <div className="rounded-2xl border border-dashboard-border bg-dashboard-surface/30 p-4">
      <h3 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("title")}
      </h3>
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 80 80" className="-rotate-90">
            {segments.map((seg) => (
              <circle
                key={seg.level}
                cx="40" cy="40" r="35"
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeDasharray={`${(seg.pct / 100) * circumference} ${circumference}`}
                strokeDashoffset={`${-(seg.offset / 100) * circumference}`}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold font-mono">{total.toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground">{t("total")}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {segments.map((seg) => (
            <div key={seg.level} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="capitalize text-foreground">{seg.level}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-muted-foreground">
                  {seg.pct.toFixed(0)}%
                </span>
                <span className="font-mono text-foreground w-12 text-right">
                  {seg.count.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
