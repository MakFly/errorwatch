"use client";

import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCurrentOrganization } from "@/contexts/OrganizationContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { useGroup, useGroupEvents, useGroupTimeline } from "@/lib/trpc/hooks";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ErrorLevel } from "@/server/api";

import { DebugProfilePanel } from "@/components/issue-detail/DebugProfilePanel";

// ─── helpers ─────────────────────────────────────────────────────────────────

const levelColor: Record<ErrorLevel, string> = {
  fatal: "text-signal-fatal",
  error: "text-signal-error",
  warning: "text-signal-warning",
  info: "text-signal-info",
  debug: "text-signal-debug",
};

const levelBg: Record<ErrorLevel, string> = {
  fatal: "bg-signal-fatal/10 text-signal-fatal border-signal-fatal/30",
  error: "bg-signal-error/10 text-signal-error border-signal-error/30",
  warning: "bg-signal-warning/10 text-signal-warning border-signal-warning/30",
  info: "bg-signal-info/10 text-signal-info border-signal-info/30",
  debug: "bg-signal-debug/10 text-signal-debug border-signal-debug/30",
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
      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
      aria-label="copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-signal-ok" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const h = 36;
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
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full text-signal-error" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
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
      <div className="border-b border-dashboard-border px-6 py-3 md:px-8">
        <Link
          href={`/dashboard/${currentOrgSlug}/${currentProjectSlug}/issues`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-mono">{t("back")}</span>
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
  const { currentOrgSlug } = useCurrentOrganization();
  const { currentProjectSlug } = useCurrentProject();
  const tHeader = useTranslations("issueDetail.header");
  const tSeverity = useTranslations("issues.severity");
  const tDetail = useTranslations("issueDetail");

  const { data: group, isLoading, error } = useGroup(fingerprint);
  const { data: eventsData } = useGroupEvents(fingerprint, 1, 50);
  // Initial selection comes from `?event=<id>` (deep-link from the Issues list signals strip).
  const initialEventId = searchParams?.get("event") ?? null;
  const [selectedEventId] = useState<string | null>(initialEventId);
  const { data: timeline } = useGroupTimeline(fingerprint);

  const events = eventsData?.events || [];
  const selectedEvent = useMemo(() => {
    if (!events.length) return null;
    if (selectedEventId) return events.find((e) => e.id === selectedEventId) || events[0];
    return events[0];
  }, [events, selectedEventId]);

  if (isLoading) return null;
  if (error || !group) return <ErrorState />;

  const timelineData =
    timeline && timeline.length > 0
      ? timeline.map((p) => ({ date: p.date, count: p.count }))
      : [{ date: new Date(group.firstSeen).toISOString().split("T")[0], count: group.count }];

  const titleSource = group.title && group.title.length > 0 ? group.title : group.message;
  const { type: exceptionType, cleanMessage } = parseExceptionType(titleSource);
  const lvlColor = levelColor[group.level as ErrorLevel];
  const lvlBg = levelBg[group.level as ErrorLevel];

  return (
    <div className="flex flex-1 flex-col">
      {/* Back link */}
      <div className="border-b border-dashboard-border px-6 py-2.5 md:px-8">
        <Link
          href={`/dashboard/${currentOrgSlug}/${currentProjectSlug}/issues`}
          className="inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{tHeader("issues")}</span>
        </Link>
      </div>

      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-dashboard-border bg-background/95 px-6 py-5 backdrop-blur md:px-8 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider",
                  lvlBg
                )}
              >
                {group.statusCode ? `${group.statusCode} ${tSeverity(group.level)}` : tSeverity(group.level)}
              </span>
              {exceptionType && (
                <span className={cn("font-mono text-xs font-bold uppercase tracking-wider", lvlColor)}>
                  {exceptionType}
                </span>
              )}
            </div>

            <h1 className="font-mono text-xl font-medium leading-snug text-foreground md:text-2xl">
              {cleanMessage}
            </h1>
          </div>
        </div>
      </header>

      {/* Group summary strip (count / method / last seen / sparkline) */}
      <GroupSummaryStrip
        count={group.count}
        method={selectedEvent?.request?.method ?? selectedEvent?.debug?.method ?? null}
        lastSeen={group.lastSeen}
        timelineData={timelineData}
      />

      {/* Main content: Full Debug only — full width, full height */}
      <div className="min-h-0 flex-1 bg-background">
        {selectedEvent?.debug ? (
          <DebugProfilePanel profile={selectedEvent.debug} />
        ) : (
          <div className="flex flex-col items-center justify-center bg-background px-6 py-16 text-center md:px-8">
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

function GroupSummaryStrip({
  count,
  method,
  lastSeen,
  timelineData,
}: {
  count: number;
  method: string | null;
  lastSeen: string | Date;
  timelineData: { date: string; count: number }[];
}) {
  const tStrip = useTranslations("issueDetail.summaryStrip");
  return (
    <div className="grid grid-cols-2 gap-px border-b border-dashboard-border bg-dashboard-border md:grid-cols-4">
      <SummaryStat label={tStrip("occurrences")} value={count.toLocaleString()} mono />
      <SummaryStat label={tStrip("method")} value={method ?? "—"} mono />
      <SummaryStat label={tStrip("lastSeen")} value={formatRel(lastSeen)} />
      <div className="bg-background px-5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {tStrip("last30days")}
        </div>
        <div className="mt-1.5">
          <Sparkline data={timelineData.map((p) => p.count)} />
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-background px-5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-base text-foreground", mono ? "font-mono tabular-nums" : "")}>{value}</div>
    </div>
  );
}
