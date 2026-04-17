"use client";

import Link from "next/link";
import { Globe, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import type { PerformanceDateRange } from "@/server/api";

interface ExternalCallsCardProps {
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

function durationBadgeClass(ms: number): string {
  if (ms >= 1000) return "bg-status-critical/15 text-status-critical";
  if (ms >= 300) return "bg-status-warning/15 text-status-warning";
  return "bg-muted text-muted-foreground";
}

export function ExternalCallsCard({
  projectId,
  dateRange,
  orgSlug,
  projectSlug,
  limit = 5,
}: ExternalCallsCardProps) {
  const { data, isLoading } = trpc.performance.getExternalCalls.useQuery({
    projectId,
    dateRange,
  });

  const items = (data ?? []).slice(0, limit);

  return (
    <div className="overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-surface/30">
      <div className="flex items-center justify-between border-b border-dashboard-border bg-dashboard-surface/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-status-warning" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            External calls
          </span>
        </div>
        <Link
          href={`/dashboard/${orgSlug}/${projectSlug}/performance/external-calls`}
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
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No external calls tracked yet
        </div>
      ) : (
        <div className="divide-y divide-dashboard-border">
          {items.map((c, idx) => (
            <div
              key={`${c.host}-${c.method ?? "any"}-${idx}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              {c.method ? (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                  {c.method}
                </span>
              ) : null}
              <p
                className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
                title={c.host}
              >
                {c.host}
              </p>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                ×{c.count.toLocaleString()}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded px-2 py-0.5 font-mono text-xs font-medium tabular-nums",
                  durationBadgeClass(c.p95Duration)
                )}
              >
                {formatMs(c.p95Duration)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
