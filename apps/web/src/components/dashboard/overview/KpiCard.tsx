"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

export interface KpiDelta {
  value: string;
  positive?: boolean;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: KpiDelta;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  loading,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashboard-border bg-dashboard-surface/30 p-4",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {value}
          </span>
          {delta ? (
            <span
              className={cn(
                "font-mono text-xs",
                delta.positive === true && "text-status-healthy",
                delta.positive === false && "text-status-critical",
                delta.positive === undefined && "text-muted-foreground"
              )}
            >
              {delta.value}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
