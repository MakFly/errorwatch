"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { DeviceType, DeviceStats } from "@/server/api";

interface DeviceDistributionBarProps {
  stats: DeviceStats;
  activeFilter: DeviceType | "all";
  onFilterChange: (device: DeviceType | "all") => void;
  isLoading?: boolean;
  className?: string;
}

const deviceStyles: Record<
  DeviceType,
  { color: string; bgColor: string; Icon: typeof Monitor }
> = {
  desktop: { color: "bg-blue-500",   bgColor: "bg-blue-500/20",   Icon: Monitor },
  mobile:  { color: "bg-green-500",  bgColor: "bg-green-500/20",  Icon: Smartphone },
  tablet:  { color: "bg-purple-500", bgColor: "bg-purple-500/20", Icon: Tablet },
};

export function DeviceDistributionBar({
  stats,
  activeFilter,
  onFilterChange,
  isLoading,
  className,
}: DeviceDistributionBarProps) {
  const t = useTranslations("replays");
  const total = stats.desktop + stats.mobile + stats.tablet;

  // Loading state
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
          {["desktop", "mobile", "tablet"].map((device) => (
            <div key={device} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
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
          {t("empty.noSessions")}
        </p>
      </div>
    );
  }

  const segments = (["desktop", "mobile", "tablet"] as DeviceType[]).filter(
    (device) => stats[device] > 0
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-issues-border bg-issues-surface/30 p-4",
        className
      )}
    >
      {/* Distribution bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-issues-border">
        {segments.map((device) => {
          const percentage = (stats[device] / total) * 100;
          const styles = deviceStyles[device];
          const label = t(`device.${device}` as const);

          return (
            <button
              key={device}
              onClick={() =>
                onFilterChange(activeFilter === device ? "all" : device)
              }
              className={cn(
                "h-full transition-all hover:opacity-80",
                styles.color,
                activeFilter !== "all" &&
                  activeFilter !== device &&
                  "opacity-30"
              )}
              style={{ width: `${percentage}%` }}
              title={`${label}: ${stats[device]} (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {segments.map((device) => {
          const styles = deviceStyles[device];
          const isActive = activeFilter === device;
          const Icon = styles.Icon;

          return (
            <button
              key={device}
              onClick={() =>
                onFilterChange(activeFilter === device ? "all" : device)
              }
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-all",
                isActive
                  ? cn(styles.bgColor, "ring-1 ring-current")
                  : "hover:bg-issues-surface"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "font-medium uppercase tracking-wide",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
                style={{ fontSize: "10px" }}
              >
                {t(`device.${device}` as const)}
              </span>
              <span
                className={cn(
                  "font-mono text-xs",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {stats[device]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
