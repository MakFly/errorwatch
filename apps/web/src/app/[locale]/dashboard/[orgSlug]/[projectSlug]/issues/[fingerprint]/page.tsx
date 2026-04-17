"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCurrentOrganization } from "@/contexts/OrganizationContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { useGroup, useGroupEvents, useGroupTimeline } from "@/lib/trpc/hooks";
import { trpc } from "@/lib/trpc/client";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Globe,
  Route,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ErrorLevel } from "@/server/api";

import { EventTimeline, StackTraceViewer, ContextCards } from "@/components/issue-detail";
import { EventListSidebar } from "@/components/issues/EventListSidebar";
import { TagsPanel } from "@/components/issues/TagsPanel";

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
  const w = 160;
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
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-40 text-signal-error" preserveAspectRatio="none">
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

// ─── Request Section ─────────────────────────────────────────────────────────

function RequestSection({
  request,
}: {
  request: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    query_string?: string;
    data?: unknown;
  };
}) {
  const [headersOpen, setHeadersOpen] = useState(false);
  const headerEntries = request.headers ? Object.entries(request.headers) : [];

  const methodColor: Record<string, string> = {
    GET: "text-signal-info",
    POST: "text-signal-ok",
    PUT: "text-signal-warning",
    PATCH: "text-signal-warning",
    DELETE: "text-signal-fatal",
  };
  const mColor = request.method
    ? methodColor[request.method.toUpperCase()] ?? "text-muted-foreground"
    : "text-muted-foreground";

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-dashboard-border/60 px-6 py-3 text-sm md:px-8">
        {request.method && (
          <span className={cn("font-mono text-sm font-bold uppercase", mColor)}>{request.method}</span>
        )}
        {request.url && (
          <div className="flex min-w-0 items-center gap-2">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <code className="truncate font-mono text-sm text-muted-foreground">{request.url}</code>
          </div>
        )}
      </div>

      {request.query_string && (
        <div className="border-b border-dashboard-border/60 px-6 py-3 md:px-8">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Query</div>
          <code className="block break-all font-mono text-sm text-foreground">{request.query_string}</code>
        </div>
      )}

      {headerEntries.length > 0 && (
        <div className="border-b border-dashboard-border/60">
          <button
            onClick={() => setHeadersOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground md:px-8"
          >
            {headersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Headers · {headerEntries.length}
          </button>
          {headersOpen && (
            <div className="divide-y divide-dashboard-border/40 border-t border-dashboard-border/40">
              {headerEntries.map(([k, v]) => (
                <div key={k} className="flex gap-4 px-6 py-2 font-mono text-sm md:px-8">
                  <span className="w-44 shrink-0 truncate text-muted-foreground">{k}</span>
                  <span className="break-all text-foreground">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {request.data !== undefined && request.data !== null && (
        <div className="border-b border-dashboard-border/60 px-6 py-3 md:px-8">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Body</div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm text-foreground">
            {typeof request.data === "string" ? request.data : JSON.stringify(request.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Trace link ──────────────────────────────────────────────────────────────

function TraceLink({
  traceId,
  spanId,
  orgSlug,
  projectSlug,
}: {
  traceId: string;
  spanId?: string | null;
  orgSlug: string;
  projectSlug: string;
}) {
  const t = useTranslations("issueDetail.tabs");
  return (
    <Link
      href={`/dashboard/${orgSlug}/${projectSlug}/performance/transactions?traceId=${traceId}`}
      className="group flex items-center gap-3 border-t border-dashboard-border px-6 py-3 font-mono text-sm transition-colors hover:bg-muted/20 md:px-8"
    >
      <Route className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("trace")}
      </span>
      <code className="min-w-0 flex-1 truncate text-muted-foreground">
        {traceId}
        {spanId && <span className="ml-2 text-muted-foreground/70">· span {spanId.slice(0, 16)}</span>}
      </code>
      <span className="shrink-0 text-sm text-muted-foreground transition-colors group-hover:text-foreground">→</span>
    </Link>
  );
}

// ─── Error State ─────────────────────────────────────────────────────────────

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
  const { currentOrgSlug } = useCurrentOrganization();
  const { currentProjectSlug } = useCurrentProject();
  const tTabs = useTranslations("issueDetail.tabs");
  const tHeader = useTranslations("issueDetail.header");
  const tSeverity = useTranslations("issues.severity");
  const tOcc = useTranslations("issueDetail.occurrenceChart");

  const { data: group, isLoading, error } = useGroup(fingerprint);
  const { data: eventsData } = useGroupEvents(fingerprint, 1, 10);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { data: timeline } = useGroupTimeline(fingerprint);
  const { data: releasesData } = trpc.groups.getReleases.useQuery({ fingerprint }, { enabled: !!fingerprint });

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

  const hasTags = selectedEvent?.tags && Object.keys(selectedEvent.tags).length > 0;
  const hasRequest = !!selectedEvent?.request;
  const hasTrace = !!selectedEvent?.traceId;
  const { type: exceptionType, cleanMessage } = parseExceptionType(group.message);
  const lvlColor = levelColor[group.level as ErrorLevel];
  const lvlBg = levelBg[group.level as ErrorLevel];

  return (
    <div className="flex flex-1 flex-col">
      {/* Back link */}
      <div className="border-b border-dashboard-border px-6 py-3 md:px-8">
        <Link
          href={`/dashboard/${currentOrgSlug}/${currentProjectSlug}/issues`}
          className="inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{tHeader("issues")}</span>
        </Link>
      </div>

      {/* Title block */}
      <div className="border-b border-dashboard-border px-6 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
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

        <div className="mt-4 flex items-center gap-2">
          <code className="font-mono text-sm">
            <span className="text-signal-info">{group.file}</span>
            <span className="text-muted-foreground/60">:</span>
            <span className="text-signal-warning">{group.line}</span>
          </code>
          <CopyInline text={`${group.file}:${group.line}`} />
        </div>
      </div>

      {/* Stats grid (Sentry-style) */}
      <div className="grid grid-cols-2 gap-px border-b border-dashboard-border bg-dashboard-border md:grid-cols-4">
        <div className="bg-background px-6 py-4 md:px-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tOcc("occurrences")}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
            {group.count.toLocaleString()}
          </div>
        </div>
        <div className="bg-background px-6 py-4 md:px-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tOcc("firstSeen")}
          </div>
          <div className="mt-1 font-mono text-lg text-foreground">{formatRel(group.firstSeen)}</div>
        </div>
        <div className="bg-background px-6 py-4 md:px-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tOcc("lastSeen")}
          </div>
          <div className="mt-1 font-mono text-lg text-foreground">{formatRel(group.lastSeen)}</div>
        </div>
        <div className="bg-background px-6 py-4 md:px-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tOcc("last30days")}
          </div>
          <div className="mt-1">
            <Sparkline data={timelineData.map((p) => p.count)} />
          </div>
        </div>
      </div>

      {/* Tabs + split */}
      <Tabs defaultValue="stack" className="flex min-w-0 flex-1 flex-col">
        <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b border-dashboard-border bg-transparent p-0 px-4 md:px-6">
          {(["stack", "breadcrumbs", "request", "context"] as const).map((tab) => {
            const disabled = tab === "request" && !hasRequest;
            return (
              <TabsTrigger
                key={tab}
                value={tab}
                disabled={disabled}
                className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 font-mono text-sm font-medium uppercase tracking-wider text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-pulse-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none disabled:opacity-30"
              >
                {tTabs(tab)}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr]">
          <div className="border-b border-dashboard-border lg:border-b-0 lg:border-r">
            <EventListSidebar
              events={events}
              selectedEventId={selectedEventId ?? events[0]?.id ?? null}
              onSelectEvent={setSelectedEventId}
              orgSlug={currentOrgSlug || ""}
              projectSlug={currentProjectSlug || ""}
            />
          </div>

          <div className="min-w-0">
            <TabsContent value="stack" className="mt-0">
              <StackTraceViewer
                stack={selectedEvent?.stack || "No stack trace available"}
                highlightFile={group.file}
                highlightLine={group.line}
              />
              {hasTrace && selectedEvent?.traceId && (
                <TraceLink
                  traceId={selectedEvent.traceId}
                  spanId={selectedEvent.spanId}
                  orgSlug={currentOrgSlug || ""}
                  projectSlug={currentProjectSlug || ""}
                />
              )}
              {hasTags && <TagsPanel tags={selectedEvent!.tags} />}
            </TabsContent>

            <TabsContent value="breadcrumbs" className="mt-0">
              {selectedEvent && (
                <EventTimeline
                  breadcrumbs={selectedEvent.breadcrumbs}
                  errorTimestamp={selectedEvent.createdAt}
                  errorMessage={group.message}
                  sessionId={selectedEvent.sessionId}
                  errorEventId={selectedEvent.id}
                  orgSlug={currentOrgSlug || ""}
                  projectSlug={currentProjectSlug || ""}
                />
              )}
            </TabsContent>

            <TabsContent value="request" className="mt-0">
              {selectedEvent?.request && <RequestSection request={selectedEvent.request} />}
            </TabsContent>

            <TabsContent value="context" className="mt-0">
              <ContextCards
                env={selectedEvent?.env}
                contexts={selectedEvent?.contexts}
                releases={releasesData?.releases}
                firstSeenIn={releasesData?.firstSeenIn}
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
