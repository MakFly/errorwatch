"use client";

import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";

interface UsersUnderFrictionListProps {
  projectId: string;
  limit?: number;
}

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return "—";
  const now = Date.now();
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMins = Math.floor((now - then) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function deviceIcon(type: string | null): string {
  if (type === "mobile") return "📱";
  if (type === "tablet") return "🖥";
  return "🖥";
}

export function UsersUnderFrictionList({
  projectId,
  limit = 5,
}: UsersUnderFrictionListProps) {
  const { data, isLoading } = trpc.replay.getSessionsWithErrors.useQuery({
    projectId,
    filters: { errorCountMin: 1 },
    page: 1,
    limit,
  });

  const sessions = data?.sessions ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-surface/30">
      <div className="flex items-center justify-between border-b border-dashboard-border bg-dashboard-surface/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-status-warning" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            Users under friction
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: limit }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No friction detected. Enable Session Replay to track user frustration.
        </div>
      ) : (
        <div className="divide-y divide-dashboard-border">
          {sessions.map((s) => {
            const identifier = s.userId || s.id.slice(0, 8);
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="text-base" aria-hidden>
                  {deviceIcon(s.deviceType)}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-mono text-sm text-foreground"
                    title={identifier}
                  >
                    {identifier}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {s.browser ?? "unknown"} · {s.os ?? "unknown"} ·{" "}
                    {formatTimeAgo(s.startedAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded bg-status-critical/15 px-2 py-0.5 font-mono text-xs font-medium text-status-critical tabular-nums">
                  ×{s.errorCount}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
