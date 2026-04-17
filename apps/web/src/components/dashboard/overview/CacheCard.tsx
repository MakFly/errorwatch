"use client";

import Link from "next/link";
import { Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import type { PerformanceDateRange } from "@/server/api";

interface CacheCardProps {
  projectId: string;
  dateRange: PerformanceDateRange;
  orgSlug: string;
  projectSlug: string;
  limit?: number;
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function hitRateClass(rate: number): string {
  if (rate >= 90) return "text-status-healthy";
  if (rate >= 70) return "text-status-warning";
  return "text-status-critical";
}

export function CacheCard({
  projectId,
  dateRange,
  orgSlug,
  projectSlug,
  limit = 5,
}: CacheCardProps) {
  const { data, isLoading } = trpc.performance.getCache.useQuery({
    projectId,
    dateRange,
  });

  const entries = (data?.entries ?? []).slice(0, limit);
  const summary = data?.summary;

  return (
    <div className="overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-surface/30">
      <div className="flex items-center justify-between border-b border-dashboard-border bg-dashboard-surface/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-status-warning" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            Cache
          </span>
          {summary ? (
            <span
              className={cn(
                "rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-medium",
                hitRateClass(summary.hitRate)
              )}
            >
              {summary.hitRate.toFixed(1)}% hit
            </span>
          ) : null}
        </div>
        <Link
          href={`/dashboard/${orgSlug}/${projectSlug}/performance/cache`}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: limit }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No cache operations tracked yet
        </div>
      ) : (
        <div className="divide-y divide-dashboard-border">
          {entries.map((e) => (
            <div key={e.op} className="flex items-center gap-3 px-4 py-3">
              <p
                className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
                title={e.op}
              >
                {e.op}
              </p>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                ×{e.count.toLocaleString()}
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-xs font-medium tabular-nums",
                  hitRateClass(e.hitRate)
                )}
              >
                {e.hitRate.toFixed(1)}%
              </span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                {formatMs(e.avgDuration)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
