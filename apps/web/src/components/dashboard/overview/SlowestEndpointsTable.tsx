"use client";

import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import type { PerformanceDateRange } from "@/server/api";

interface SlowestEndpointsTableProps {
  projectId: string;
  dateRange: PerformanceDateRange;
  limit?: number;
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function durationBadgeClass(ms: number): string {
  if (ms >= 1000) return "bg-status-critical/15 text-status-critical";
  if (ms >= 300) return "bg-status-warning/15 text-status-warning";
  return "bg-muted text-muted-foreground";
}

function splitName(name: string): { method: string | null; path: string } {
  const match = name.match(/^([A-Z]+)\s+(.+)$/);
  if (match) return { method: match[1], path: match[2] };
  return { method: null, path: name };
}

export function SlowestEndpointsTable({
  projectId,
  dateRange,
  limit = 5,
}: SlowestEndpointsTableProps) {
  const { data, isLoading } = trpc.performance.getTopEndpoints.useQuery({
    projectId,
    dateRange,
  });

  const endpoints = (data ?? [])
    .slice()
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, limit);

  return (
    <div className="overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-surface/30">
      <div className="flex items-center justify-between border-b border-dashboard-border bg-dashboard-surface/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-status-warning" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            Slowest endpoints
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: limit }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : endpoints.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No endpoints tracked for this period
        </div>
      ) : (
        <div className="divide-y divide-dashboard-border">
          {endpoints.map((ep) => {
            const { method, path } = splitName(ep.name);
            return (
              <div
                key={`${ep.op}-${ep.name}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                {method ? (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                    {method}
                  </span>
                ) : null}
                <p
                  className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
                  title={path}
                >
                  {path}
                </p>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                  ×{ep.count.toLocaleString()}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded px-2 py-0.5 font-mono text-xs font-medium tabular-nums",
                    durationBadgeClass(ep.avgDuration)
                  )}
                >
                  {formatMs(ep.avgDuration)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
