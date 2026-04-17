"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ErrorLevel } from "@/server/api";

interface SeverityStats {
  fatal: number;
  error: number;
  warning: number;
  info: number;
  debug: number;
}

interface SeverityDistributionBarProps {
  stats: SeverityStats;
  activeFilter: ErrorLevel | "all";
  onFilterChange: (level: ErrorLevel | "all") => void;
  isLoading?: boolean;
  className?: string;
}

const severityStyles: Record<
  ErrorLevel,
  { color: string; bgColor: string }
> = {
  fatal: { color: "bg-signal-fatal", bgColor: "bg-signal-fatal/20" },
  error: { color: "bg-signal-error", bgColor: "bg-signal-error/20" },
  warning: { color: "bg-signal-warning", bgColor: "bg-signal-warning/20" },
  info: { color: "bg-signal-info", bgColor: "bg-signal-info/20" },
  debug: { color: "bg-signal-debug", bgColor: "bg-signal-debug/20" },
};

export function SeverityDistributionBar({
  stats,
  activeFilter,
  onFilterChange,
  isLoading,
  className,
}: SeverityDistributionBarProps) {
  const t = useTranslations("issues.severity");
  const total =
    stats.fatal + stats.error + stats.warning + stats.info + stats.debug;

  // Loading state - show skeleton
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-issues-border bg-issues-surface/30 p-4",
          className
        )}
      >
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="mt-3 flex items-center justify-center gap-6">
          {["fatal", "error", "warning", "info", "debug"].map((level) => (
            <div key={level} className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state - only show when not loading
  if (total === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-issues-border bg-issues-surface/30 p-4",
          className
        )}
      >
        <div className="h-3 w-full rounded-full bg-issues-border" />
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {t("noSignalsDetected")}
        </p>
      </div>
    );
  }

  const segments = (
    ["fatal", "error", "warning", "info", "debug"] as ErrorLevel[]
  ).filter((level) => stats[level] > 0);

  return (
    <div
      className={cn(
        "rounded-lg border border-issues-border bg-issues-surface/30 p-4",
        className
      )}
    >
      {/* Distribution bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-issues-border">
        {segments.map((level) => {
          const percentage = (stats[level] / total) * 100;
          const styles = severityStyles[level];

          return (
            <button
              key={level}
              onClick={() =>
                onFilterChange(activeFilter === level ? "all" : level)
              }
              className={cn(
                "h-full transition-all hover:opacity-80",
                styles.color,
                activeFilter !== "all" &&
                  activeFilter !== level &&
                  "opacity-30"
              )}
              style={{ width: `${percentage}%` }}
              title={`${t(level)}: ${stats[level]} (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {segments.map((level) => {
          const styles = severityStyles[level];
          const isActive = activeFilter === level;

          return (
            <button
              key={level}
              onClick={() =>
                onFilterChange(activeFilter === level ? "all" : level)
              }
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-all",
                isActive
                  ? cn(styles.bgColor, "ring-1 ring-current")
                  : "hover:bg-issues-surface"
              )}
            >
              <span
                className={cn("h-2.5 w-2.5 rounded-full", styles.color)}
              />
              <span
                className={cn(
                  "font-medium uppercase tracking-wide",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
                style={{ fontSize: "10px" }}
              >
                {t(level)}
              </span>
              <span
                className={cn(
                  "font-mono text-xs",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {stats[level]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
