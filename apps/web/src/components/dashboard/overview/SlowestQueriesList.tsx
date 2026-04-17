"use client";

import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import type { PerformanceDateRange } from "@/server/api";

interface SlowestQueriesListProps {
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

export function SlowestQueriesList({
  projectId,
  dateRange,
  limit = 5,
}: SlowestQueriesListProps) {
  const { data, isLoading } = trpc.performance.getSpanAnalysis.useQuery({
    projectId,
    dateRange,
  });

  const queries = (data?.slowQueries ?? []).slice(0, limit);

  return (
    <div className="overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-surface/30">
      <div className="flex items-center justify-between border-b border-dashboard-border bg-dashboard-surface/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-status-warning" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            Slowest queries
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: limit }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : queries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No slow queries detected
        </div>
      ) : (
        <div className="divide-y divide-dashboard-border">
          {queries.map((q, idx) => (
            <div
              key={`${q.transactionId}-${idx}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-mono text-xs text-status-warning"
                  title={q.description}
                >
                  {q.description}
                </p>
                <p
                  className="truncate text-[11px] text-muted-foreground"
                  title={q.transactionName}
                >
                  {q.transactionName}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded px-2 py-0.5 font-mono text-xs font-medium tabular-nums",
                  durationBadgeClass(q.duration)
                )}
              >
                {formatMs(q.duration)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
