"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";

interface ExceptionsInboxProps {
  projectId: string;
  orgSlug: string;
  projectSlug: string;
  limit?: number;
}

const severityDot: Record<string, string> = {
  fatal: "bg-red-500 shadow-red-500/50",
  error: "bg-red-400 shadow-red-400/40",
  warning: "bg-amber-400 shadow-amber-400/40",
  info: "bg-blue-400 shadow-blue-400/40",
  debug: "bg-purple-400 shadow-purple-400/40",
};

function formatTimeAgo(date: Date | string, justNow: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMins = Math.floor((now - then) / 60000);
  if (diffMins < 1) return justNow;
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function ExceptionsInbox({
  projectId,
  orgSlug,
  projectSlug,
  limit = 5,
}: ExceptionsInboxProps) {
  const t = useTranslations("dashboard.overview.exceptionsInbox");
  const tCommon = useTranslations("common");
  const { data, isLoading } = trpc.attention.getTop.useQuery({
    projectId,
    limit,
  });

  const items = data ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-surface/30">
      <div className="flex items-center justify-between border-b border-dashboard-border bg-dashboard-surface/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-status-warning" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            {t("title")}
          </span>
          {!isLoading && items.length > 0 ? (
            <span className="rounded-full bg-status-warning/20 px-2 py-0.5 font-mono text-xs font-medium text-status-warning">
              {items.length}
            </span>
          ) : null}
        </div>
        <Link
          href={`/dashboard/${orgSlug}/${projectSlug}/issues`}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("viewAll")}
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
          {t("empty")}
        </div>
      ) : (
        <div className="divide-y divide-dashboard-border">
          {items.map((item) => {
            const dotClass =
              severityDot[item.level ?? "error"] ?? severityDot.error;
            const title = item.exceptionType || item.message;
            const subtitle =
              item.exceptionType && item.exceptionValue
                ? item.exceptionValue
                : item.exceptionType
                  ? item.message
                  : null;
            return (
              <Link
                key={item.fingerprint}
                href={`/dashboard/${orgSlug}/${projectSlug}/issues/${item.fingerprint}`}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-dashboard-surface/70"
              >
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full shadow-sm", dotClass)}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-mono text-sm font-medium text-foreground"
                    title={title}
                  >
                    {title}
                  </p>
                  {subtitle ? (
                    <p
                      className="truncate text-xs text-muted-foreground"
                      title={subtitle}
                    >
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  ×{item.count?.toLocaleString() || 1}
                </span>
                <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
                  {formatTimeAgo(item.lastSeen, tCommon("justNow"))}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
