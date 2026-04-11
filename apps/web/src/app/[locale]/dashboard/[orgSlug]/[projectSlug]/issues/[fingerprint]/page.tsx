"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCurrentOrganization } from "@/contexts/OrganizationContext";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { useGroup, useGroupEvents, useGroupTimeline } from "@/lib/trpc/hooks";
import { trpc } from "@/lib/trpc/client";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

// Issue detail components
import {
  IssueHeader,
  OccurrenceChart,
  EventTimeline,
  StackTraceViewer,
  ContextCards,
} from "@/components/issue-detail";

import { EventNavigator } from "@/components/issues/EventNavigator";
import { TagsPanel } from "@/components/issues/TagsPanel";

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

  const methodColors: Record<string, string> = {
    GET: "bg-signal-info/10 text-signal-info border-signal-info/30",
    POST: "bg-signal-ok/10 text-signal-ok border-signal-ok/30",
    PUT: "bg-signal-warning/10 text-signal-warning border-signal-warning/30",
    PATCH: "bg-signal-warning/10 text-signal-warning border-signal-warning/30",
    DELETE: "bg-signal-fatal/10 text-signal-fatal border-signal-fatal/30",
  };

  const methodClass =
    request.method
      ? methodColors[request.method.toUpperCase()] ?? "bg-muted/50 text-muted-foreground border-muted"
      : "bg-muted/50 text-muted-foreground border-muted";

  return (
    <div className="rounded-xl border border-issues-border bg-issues-surface/30 p-4 space-y-3">
      <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
        Request
      </h3>

      {/* Method + URL */}
      <div className="flex items-center gap-2 flex-wrap">
        {request.method && (
          <Badge
            variant="outline"
            className={`font-mono text-xs font-bold ${methodClass}`}
          >
            {request.method.toUpperCase()}
          </Badge>
        )}
        {request.url && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <code className="font-mono text-xs text-muted-foreground break-all">
              {request.url}
            </code>
          </div>
        )}
      </div>

      {/* Query string */}
      {request.query_string && (
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Query
          </span>
          <code className="mt-1 block rounded-md bg-muted/10 px-3 py-2 font-mono text-xs text-foreground">
            {request.query_string}
          </code>
        </div>
      )}

      {/* Headers (collapsible) */}
      {headerEntries.length > 0 && (
        <div>
          <button
            onClick={() => setHeadersOpen((v) => !v)}
            className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            {headersOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Headers ({headerEntries.length})
          </button>

          {headersOpen && (
            <div className="mt-2 rounded-md border border-issues-border divide-y divide-issues-border overflow-hidden">
              {headerEntries.map(([key, value]) => (
                <div key={key} className="flex gap-2 px-3 py-1.5 text-xs">
                  <span className="font-mono text-muted-foreground shrink-0 w-40 truncate">
                    {key}
                  </span>
                  <span className="font-mono text-foreground break-all">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* POST data */}
      {request.data !== undefined && request.data !== null && (
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Body
          </span>
          <pre className="mt-1 rounded-md bg-muted/10 px-3 py-2 font-mono text-xs text-foreground overflow-x-auto whitespace-pre-wrap break-all">
            {typeof request.data === "string"
              ? request.data
              : JSON.stringify(request.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────────────────

function ErrorState() {
  const { currentOrgSlug } = useCurrentOrganization();
  const { currentProjectSlug } = useCurrentProject();
  const t = useTranslations("issueDetail.errorPage");

  return (
    <div className="min-h-screen bg-issues-bg p-4 md:p-6 lg:p-8">
      <Link
        href={`/dashboard/${currentOrgSlug}/${currentProjectSlug}/issues`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="font-mono">{t("back")}</span>
      </Link>

      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-signal-error/20 blur-2xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-signal-error/30 bg-signal-error/10">
            <AlertTriangle className="h-10 w-10 text-signal-error" strokeWidth={1.5} />
          </div>
        </div>
        <h3 className="mt-8 font-mono text-xl font-medium text-signal-error">
          {t("signalNotFound")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("signalNotFoundDesc")}
        </p>
        <Link
          href={`/dashboard/${currentOrgSlug}/${currentProjectSlug}/issues`}
          className="mt-6 font-mono text-sm text-pulse-primary hover:text-pulse-primary/80 transition-colors"
        >
          {t("returnToIssues")}
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IssueDetailPage() {
  const params = useParams();
  const fingerprint = params.fingerprint as string;
  const { currentOrgSlug, currentOrgId } = useCurrentOrganization();
  const { currentProjectSlug } = useCurrentProject();

  // Fetch data
  const {
    data: group,
    isLoading: groupLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(fingerprint);

  const { data: eventsData } = useGroupEvents(fingerprint, 1, 10);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { data: timeline } = useGroupTimeline(fingerprint);

  // Fetch releases
  const { data: releasesData } = trpc.groups.getReleases.useQuery(
    { fingerprint },
    { enabled: !!fingerprint }
  );

  // Fetch members for assignment
  const { data: members } = trpc.members.getByOrganization.useQuery(
    { organizationId: currentOrgId || "" },
    { enabled: !!currentOrgId }
  );

  // Mutations
  const updateAssignmentMutation = trpc.groups.updateAssignment.useMutation({
    onSuccess: () => refetchGroup(),
  });

  // Derive data
  const events = eventsData?.events || [];
  const selectedEvent = useMemo(() => {
    if (!events.length) return null;
    if (selectedEventId) {
      return events.find((e) => e.id === selectedEventId) || events[0];
    }
    return events[0];
  }, [events, selectedEventId]);

  const membersList = useMemo(() => {
    return (members || []).map((m) => ({
      id: m.userId,
      name: m.user?.name || null,
      email: m.user?.email,
      image: m.user?.image || null,
    }));
  }, [members]);

  // Loading state
  if (groupLoading) {
    return null;
  }

  // Error state
  if (groupError || !group) {
    return <ErrorState />;
  }

  // Prepare timeline data
  const timelineData =
    timeline && timeline.length > 0
      ? timeline.map((t) => ({ date: t.date, count: t.count }))
      : [{ date: new Date(group.firstSeen).toISOString().split("T")[0], count: group.count }];

  return (
    <div className="min-h-screen bg-issues-bg p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <IssueHeader
        message={group.message}
        file={group.file}
        line={group.line}
        level={group.level}
        statusCode={group.statusCode}
        orgSlug={currentOrgSlug || ""}
        projectSlug={currentProjectSlug || ""}
        assignedTo={group.assignedTo}
        members={membersList}
        onAssign={(userId) =>
          updateAssignmentMutation.mutate({ fingerprint, assignedTo: userId })
        }
        isAssigning={updateAssignmentMutation.isPending}
      />

      {/* Occurrence Chart */}
      <OccurrenceChart
        count={group.count}
        firstSeen={group.firstSeen}
        lastSeen={group.lastSeen}
        timeline={timelineData}
      />

      {/* Event Navigator */}
      {events.length > 0 && (
        <EventNavigator
          events={events}
          selectedEventId={selectedEventId ?? (events[0]?.id ?? null)}
          onSelectEvent={setSelectedEventId}
          projectSlug={currentProjectSlug || ""}
        />
      )}

      {/* Event Timeline */}
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

      {/* Stack Trace */}
      <StackTraceViewer
        stack={selectedEvent?.stack || "No stack trace available"}
        highlightFile={group.file}
        highlightLine={group.line}
      />

      {/* Tags */}
      {selectedEvent?.tags && Object.keys(selectedEvent.tags).length > 0 && (
        <TagsPanel tags={selectedEvent.tags} />
      )}

      {/* Request */}
      {selectedEvent?.request && (
        <RequestSection request={selectedEvent.request} />
      )}

      {/* Context Cards */}
      <ContextCards
        env={selectedEvent?.env}
        contexts={selectedEvent?.contexts}
        releases={releasesData?.releases}
        firstSeenIn={releasesData?.firstSeenIn}
      />
    </div>
  );
}
