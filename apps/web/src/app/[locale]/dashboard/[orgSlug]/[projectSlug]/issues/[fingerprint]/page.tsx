"use client";

import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCurrentOrganization } from "@/contexts/OrganizationContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import {
  useGroup,
  useGroupEvents,
  useGroupTimeline,
  useMembersByOrganization,
  useUpdateGroupStatus,
} from "@/lib/trpc/hooks";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ErrorLevel } from "@/server/api";

import { DebugProfilePanel } from "@/components/issue-detail/DebugProfilePanel";
import { EventSourcePanel } from "@/components/issue-detail/EventSourcePanel";
import { StatusHistoryTimeline } from "@/components/issue-detail/StatusHistoryTimeline";

// ─── helpers ─────────────────────────────────────────────────────────────────

const levelAccent: Record<ErrorLevel, string> = {
  fatal: "bg-signal-fatal",
  error: "bg-signal-error",
  warning: "bg-signal-warning",
  info: "bg-signal-info",
  debug: "bg-signal-debug",
};

const levelChip: Record<ErrorLevel, string> = {
  fatal: "bg-signal-fatal text-white",
  error: "bg-signal-error text-white",
  warning: "bg-signal-warning text-black",
  info: "bg-signal-info text-white",
  debug: "bg-signal-debug text-white",
};

function parseExceptionType(message: string): { type: string | null; cleanMessage: string } {
  const match = message.match(/^(?:Uncaught\s+)?(\w+(?:Error|Exception|Fault)):\s*([\s\S]*)$/);
  if (match) return { type: match[1], cleanMessage: match[2] };
  return { type: null, cleanMessage: message };
}

function formatRel(date: string | Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function CopyInline({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 220;
  const h = 32;
  const pad = 2;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const fill = `${pad},${h - pad} ${pts} ${w - pad},${h - pad}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full text-signal-error" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill="url(#spark-fill)" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────

function ErrorState() {
  const { currentOrgSlug } = useCurrentOrganization();
  const { currentProjectSlug } = useCurrentProject();
  const t = useTranslations("issueDetail.errorPage");

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-dashboard-border bg-zinc-100 px-6 py-2.5 md:px-8 dark:bg-zinc-900">
        <Link
          href={`/dashboard/${currentOrgSlug}/${currentProjectSlug}/issues`}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t("back")}</span>
        </Link>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center py-24">
        <AlertTriangle className="h-12 w-12 text-signal-error" strokeWidth={1.5} />
        <h3 className="mt-6 font-mono text-xl text-signal-error">{t("signalNotFound")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("signalNotFoundDesc")}</p>
        <Link
          href={`/dashboard/${currentOrgSlug}/${currentProjectSlug}/issues`}
          className="mt-6 font-mono text-sm text-pulse-primary hover:text-pulse-primary/80"
        >
          {t("returnToIssues")}
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function IssueDetailPage() {
  const params = useParams();
  const fingerprint = params.fingerprint as string;
  const searchParams = useSearchParams();
  const { currentOrgSlug, currentOrgId } = useCurrentOrganization();
  const { currentProjectSlug } = useCurrentProject();
  const tHeader = useTranslations("issueDetail.header");
  const tSeverity = useTranslations("issues.severity");
  const tDetail = useTranslations("issueDetail");
  const tStatus = useTranslations("issueDetail.status");

  const { data: group, isLoading, error } = useGroup(fingerprint);
  const { data: eventsData } = useGroupEvents(fingerprint, 1, 50);
  const initialEventId = searchParams?.get("event") ?? null;
  const [selectedEventId] = useState<string | null>(initialEventId);
  const { data: timeline } = useGroupTimeline(fingerprint);
  // Members list is used to resolve `resolvedBy` (user id) into a display name,
  // mirroring how assignment dropdowns work elsewhere. Skipped until org id known.
  const { data: members } = useMembersByOrganization(currentOrgId || "");
  const updateStatus = useUpdateGroupStatus();

  const events = eventsData?.events || [];
  const selectedEvent = useMemo(() => {
    if (!events.length) return null;
    if (selectedEventId) return events.find((e) => e.id === selectedEventId) || events[0];
    return events[0];
  }, [events, selectedEventId]);

  // Resolve `resolvedBy` user id into a display name. Kept above the early
  // returns so the hook order stays stable across renders (loading → loaded).
  const resolvedBy = group?.resolvedBy ?? null;
  const resolverName = useMemo(() => {
    if (!resolvedBy) return null;
    const member = members?.find((m) => m.userId === resolvedBy);
    return member?.user?.name || member?.user?.email || resolvedBy;
  }, [resolvedBy, members]);

  if (isLoading) return null;
  if (error || !group) return <ErrorState />;

  const timelineData =
    timeline && timeline.length > 0
      ? timeline.map((p) => ({ date: p.date, count: p.count }))
      : [{ date: new Date(group.firstSeen).toISOString().split("T")[0], count: group.count }];

  const titleSource = group.title && group.title.length > 0 ? group.title : group.message;
  const { type: exceptionType, cleanMessage } = parseExceptionType(titleSource);
  const lvlAccent = levelAccent[group.level as ErrorLevel];
  const lvlChip = levelChip[group.level as ErrorLevel];
  const method = selectedEvent?.request?.method ?? selectedEvent?.debug?.method ?? null;
  const url = selectedEvent?.request?.url ?? selectedEvent?.debug?.request?.url ?? null;

  const isResolved = group.status === "resolved";

  const handleToggleStatus = async () => {
    const next = isResolved ? "unresolved" : "resolved";
    try {
      await updateStatus.mutateAsync({ fingerprint, status: next });
      toast.success(next === "resolved" ? tStatus("resolvedToast") : tStatus("reopenedToast"));
    } catch {
      toast.error(tStatus("toggleError"));
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-dashboard-bg">
      {/* ── Profiler Bar (Symfony toolbar style, but at top) ─────────────────── */}
      <div className="flex items-stretch gap-px border-b border-dashboard-border bg-zinc-100 text-zinc-700 dark:border-black/40 dark:bg-zinc-950 dark:text-zinc-200">
        <Link
          href={`/dashboard/${currentOrgSlug}/${currentProjectSlug}/issues`}
          className="flex items-center gap-1.5 border-r border-dashboard-border px-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {tHeader("issues")}
        </Link>

        <ToolbarTile
          accent={lvlAccent}
          label={tSeverity(group.level)}
          value={group.statusCode ? String(group.statusCode) : group.level.toUpperCase()}
        />
        {method && <ToolbarTile label="Method" value={method} mono />}
        <ToolbarTile label="Occurrences" value={group.count.toLocaleString()} mono />
        <ToolbarTile label="Last seen" value={formatRel(group.lastSeen)} />

        <div className="ml-auto flex items-center gap-3 border-l border-dashboard-border px-4 dark:border-white/10">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            30d
          </span>
          <div className="w-40">
            <Sparkline data={timelineData.map((p) => p.count)} />
          </div>
        </div>
      </div>

      {/* ── Exception masthead ───────────────────────────────────────────────── */}
      <header className="relative border-b border-dashboard-border bg-dashboard-surface">
        <div className={cn("absolute left-0 top-0 h-full w-1", lvlAccent)} aria-hidden />
        <div className="px-6 py-6 md:px-10 md:py-8">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span>Exception</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-mono normal-case tracking-normal text-foreground/70">
              {fingerprint.slice(0, 12)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            {group.statusCode != null && (
              <span
                className={cn(
                  "inline-flex h-7 items-center rounded-sm px-2 font-mono text-[12px] font-bold tabular-nums shadow-sm",
                  lvlChip,
                )}
              >
                {group.statusCode}
              </span>
            )}
            {exceptionType && (
              <span className="font-mono text-sm font-semibold uppercase tracking-wider text-signal-error">
                {exceptionType}
              </span>
            )}
          </div>

          <h1 className="mt-2 max-w-5xl break-words font-mono text-[22px] font-semibold leading-snug text-foreground md:text-[26px]">
            {cleanMessage}
          </h1>

          {url && (
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-sm border border-dashboard-border bg-muted px-3 py-1.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {method ?? "GET"}
              </span>
              <span className="truncate font-mono text-xs text-foreground">{url}</span>
              <CopyInline text={url} />
            </div>
          )}

          {/* Resolution state + CTA. When the issue is resolved we show who
              resolved it and when — same affordance as Sentry's "Resolved by".
              A new event from any SDK auto-reopens it (regression). */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleToggleStatus}
              disabled={updateStatus.isPending}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-sm border px-3 font-mono text-xs font-semibold uppercase tracking-wider transition-colors",
                isResolved
                  ? "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400",
                updateStatus.isPending && "opacity-60",
              )}
            >
              {isResolved ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  {tStatus("reopen")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {tStatus("resolve")}
                </>
              )}
            </button>

            {isResolved && group.resolvedAt && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {tStatus.rich("resolvedBy", {
                  who: () => (
                    <span className="font-semibold text-foreground">
                      {resolverName ?? tStatus("unknownUser")}
                    </span>
                  ),
                  when: () => <span>{formatRel(group.resolvedAt!)}</span>,
                })}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Status audit timeline ────────────────────────────────────────────── */}
      <StatusHistoryTimeline fingerprint={fingerprint} />

      {/* ── Profile body ─────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 bg-background">
        {selectedEvent?.debug ? (
          <DebugProfilePanel profile={selectedEvent.debug} />
        ) : selectedEvent ? (
          <EventSourcePanel event={selectedEvent} />
        ) : (
          <div className="flex h-full min-h-full flex-col items-center justify-center bg-background px-6 py-16 text-center md:px-8">
            <p className="font-mono text-sm font-medium text-muted-foreground">
              {tDetail("noProfilerTitle")}
            </p>
            <p className="mt-2 max-w-md text-xs text-muted-foreground/80">
              {tDetail.rich("noProfilerHint", {
                code: (chunks) => <code className="font-mono text-foreground">{chunks}</code>,
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profiler bar tile ───────────────────────────────────────────────────────

function ToolbarTile({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <div className="relative flex min-w-0 items-center gap-3 border-r border-dashboard-border px-4 py-2 dark:border-white/10">
      {accent && <span className={cn("absolute left-0 top-0 h-full w-[3px]", accent)} aria-hidden />}
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-sm font-semibold text-foreground", mono && "font-mono tabular-nums")}>
        {value}
      </span>
    </div>
  );
}
