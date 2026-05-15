"use client";

import { CheckCircle2, RotateCcw, History } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useGroupStatusHistory } from "@/lib/trpc/hooks";
import type { StatusHistoryEntry } from "@/server/api";

function formatRel(date: string | Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Audit timeline of resolve/reopen transitions for an issue. Pulled from
 * `error_group_status_events` — every manual toggle is logged with the actor,
 * and the event worker writes a system row when a regression auto-reopens
 * a previously resolved group.
 */
export function StatusHistoryTimeline({ fingerprint }: { fingerprint: string }) {
  const t = useTranslations("issueDetail.status");
  const { data: entries, isLoading } = useGroupStatusHistory(fingerprint);

  if (isLoading) return null;
  if (!entries || entries.length === 0) return null;

  return (
    <section className="border-b border-dashboard-border bg-dashboard-surface px-6 py-5 md:px-10">
      <header className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("historyTitle")}
        </h2>
      </header>

      <ol className="relative space-y-3 border-l border-dashboard-border pl-5">
        {entries.map((entry) => (
          <TimelineRow key={entry.id} entry={entry} />
        ))}
      </ol>
    </section>
  );
}

function TimelineRow({ entry }: { entry: StatusHistoryEntry }) {
  const t = useTranslations("issueDetail.status");
  const isResolveTransition = entry.toStatus === "resolved";
  const Icon = isResolveTransition ? CheckCircle2 : RotateCcw;

  const label = isResolveTransition ? t("transitionResolved") : t("transitionReopened");

  // Display name: prefer the actor's name, then email; for system rows
  // (actor = null + reason = 'regression') we surface "system (regression)".
  const actorLabel =
    entry.actor === null
      ? t("bySystem")
      : t("byActor", {
          who: entry.actor.name || entry.actor.email || t("unknownUser"),
        });

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border",
          isResolveTransition
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400",
        )}
        aria-hidden
      >
        <Icon className="h-3 w-3" />
      </span>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
          {label}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">{actorLabel}</span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground/80">
          {formatRel(entry.createdAt)}
        </span>
      </div>
    </li>
  );
}
