"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowDownUp,
  Cpu,
  Database,
  FileCode,
  Globe,
  Hammer,
  Inbox,
  KeyRound,
  Mail,
  Radio,
  Route,
  ScrollText,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProfileV1 } from "@/server/api/types/error";

interface DebugProfilePanelProps {
  profile: ProfileV1;
}

type TabDef = {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Visible counter in the rail. */
  badge?: string | number;
  /** Highlights anomalies (slow, denied, errors). */
  alert?: boolean;
};

/**
 * Full request profile renderer (parity with laravel-web-profiler).
 *
 * Layout: vertical tab rail on the left, panel content on the right.
 * Each tab shows its own counter / anomaly indicator.
 */
export function DebugProfilePanel({ profile }: DebugProfilePanelProps) {
  const t = useTranslations("issueDetail.debug");
  const tabs = buildTabList(profile, (key: string) => t(`tabs.${key}`));
  const [active, setActive] = useState(tabs[0]?.value ?? "request");

  if (tabs.length === 0) {
    return <Empty>{t("empty")}</Empty>;
  }

  const current = tabs.find((t) => t.value === active) ?? tabs[0];

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background lg:flex-row">
      {/* Vertical tab rail */}
      <nav className="flex shrink-0 flex-row overflow-x-auto border-b border-dashboard-border bg-background lg:w-[220px] lg:flex-col lg:overflow-x-visible lg:border-b-0 lg:border-r">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActive(tab.value)}
            className={cn(
              "flex shrink-0 items-center gap-2 px-4 py-2.5 text-left text-xs font-medium transition-colors lg:border-l-2 lg:border-l-transparent",
              active === tab.value
                ? "bg-muted text-foreground lg:border-l-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                  tab.alert
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground",
                  active === tab.value && !tab.alert && "bg-background text-foreground",
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Panel content */}
      <div className="min-w-0 flex-1 bg-background">
        <div className="border-b border-dashboard-border px-6 py-3 md:px-8">
          <h3 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <current.icon className="h-3.5 w-3.5" />
            {current.label}
          </h3>
        </div>
        <div className="px-6 py-4 md:px-8">
          {active === "request" && profile.request && <RequestPanel request={profile.request} />}
          {active === "route" && profile.route && <RoutePanel route={profile.route} />}
          {active === "queries" && profile.queries && <QueriesPanel queries={profile.queries} />}
          {active === "cache" && profile.cache && <CachePanel cache={profile.cache} />}
          {active === "mail" && profile.mail && <MailPanel mail={profile.mail} />}
          {active === "events" && profile.events && <EventsPanel events={profile.events} />}
          {active === "views" && profile.views && <ViewsPanel views={profile.views} />}
          {active === "gates" && profile.gates && <GatesPanel gates={profile.gates} />}
          {active === "http_client" && profile.http_client && <HttpClientPanel http={profile.http_client} />}
          {active === "logs" && profile.logs && <LogsPanel logs={profile.logs} />}
          {active === "jobs" && profile.jobs && <JobsPanel jobs={profile.jobs} />}
          {active === "memory" && profile.memory && <MemoryPanel memory={profile.memory} />}
          {active === "timing" && profile.timing && <TimingPanel timing={profile.timing} />}
        </div>
      </div>
    </div>
  );
}

// ─── Tab list resolver ────────────────────────────────────────────────────────
function buildTabList(p: ProfileV1, t: (key: string) => string): TabDef[] {
  const tabs: TabDef[] = [];
  if (p.request) tabs.push({ value: "request", label: t("request"), icon: Globe });
  if (p.route) tabs.push({ value: "route", label: t("route"), icon: Route });

  if (p.queries) {
    const alert = p.queries.slow_count > 0 || p.queries.duplicate_count > 0;
    tabs.push({ value: "queries", label: t("queries"), icon: Database, badge: p.queries.total_count, alert });
  }

  if (p.cache) {
    const total = p.cache.hits + p.cache.misses + p.cache.writes + p.cache.deletes;
    if (total > 0) tabs.push({ value: "cache", label: t("cache"), icon: ArrowDownUp, badge: total });
  }

  if (p.mail && p.mail.total_count > 0) {
    tabs.push({ value: "mail", label: t("mail"), icon: Mail, badge: p.mail.total_count });
  }

  if (p.events && p.events.total_count > 0) {
    tabs.push({ value: "events", label: t("events"), icon: Radio, badge: p.events.total_count });
  }

  if (p.views && p.views.total_count > 0) {
    tabs.push({ value: "views", label: t("views"), icon: FileCode, badge: p.views.total_count });
  }

  if (p.gates && p.gates.total_count > 0) {
    tabs.push({
      value: "gates",
      label: t("gates"),
      icon: KeyRound,
      badge: p.gates.total_count,
      alert: p.gates.denied_count > 0,
    });
  }

  if (p.http_client && p.http_client.total_count > 0) {
    tabs.push({
      value: "http_client",
      label: t("http_client"),
      icon: Globe,
      badge: p.http_client.total_count,
      alert: p.http_client.requests.some((r) => r.status_code === 0 || r.status_code >= 400),
    });
  }

  if (p.logs && p.logs.total_count > 0) {
    tabs.push({
      value: "logs",
      label: t("logs"),
      icon: ScrollText,
      badge: p.logs.total_count,
      alert: p.logs.error_count > 0,
    });
  }

  if (p.jobs && p.jobs.total_count > 0) {
    tabs.push({
      value: "jobs",
      label: t("jobs"),
      icon: Hammer,
      badge: p.jobs.total_count,
      alert: p.jobs.failed_count > 0,
    });
  }

  if (p.memory) tabs.push({ value: "memory", label: t("memory"), icon: Cpu });
  if (p.timing) tabs.push({ value: "timing", label: t("timing"), icon: Timer });

  return tabs;
}

// ─── Panels ───────────────────────────────────────────────────────────────────
function RequestPanel({ request }: { request: NonNullable<ProfileV1["request"]> }) {
  return (
    <div className="space-y-5 text-xs">
      <KvBlock title="Overview">
        <Kv k="Method" v={request.method} />
        <Kv k="URL" v={request.url} mono />
        <Kv k="Path" v={request.path} mono />
        <Kv k="Format" v={request.format || "—"} />
        <Kv k="Content-Type" v={request.content_type || "—"} />
        <Kv k="Content-Length" v={String(request.content_length)} />
        {request.query_string && <Kv k="Query string" v={request.query_string} mono />}
      </KvBlock>

      <KvBlock title={`Headers (${Object.keys(request.headers).length})`}>
        {Object.entries(request.headers).map(([k, v]) => (
          <Kv key={k} k={k} v={Array.isArray(v) ? v.join(", ") : String(v)} mono />
        ))}
      </KvBlock>

      {request.cookies.length > 0 && (
        <KvBlock title={`Cookies (${request.cookies.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {request.cookies.map((c) => (
              <Badge key={c} variant="secondary" className="font-mono text-[10px]">{c}</Badge>
            ))}
          </div>
        </KvBlock>
      )}

      {request.session && (
        <KvBlock title="Session">
          <Kv k="ID" v={request.session.id} mono />
          {Object.entries(request.session.data).map(([k, v]) => (
            <Kv key={k} k={k} v={typeof v === "string" ? v : JSON.stringify(v)} mono />
          ))}
        </KvBlock>
      )}
    </div>
  );
}

function RoutePanel({ route }: { route: NonNullable<ProfileV1["route"]> }) {
  return (
    <div className="space-y-5 text-xs">
      <KvBlock title="Route">
        <Kv k="URI" v={route.uri} mono />
        <Kv k="Name" v={route.name ?? "—"} />
        <Kv k="Action" v={route.action ?? "—"} mono />
        <Kv k="Controller" v={route.controller ?? "—"} mono />
        <Kv k="Methods" v={route.methods.join(", ")} mono />
        {route.domain && <Kv k="Domain" v={route.domain} />}
        {route.prefix && <Kv k="Prefix" v={route.prefix} mono />}
      </KvBlock>

      {route.middleware.length > 0 && (
        <KvBlock title={`Middleware (${route.middleware.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {route.middleware.map((m) => (
              <Badge key={m} variant="secondary" className="font-mono text-[10px]">{m}</Badge>
            ))}
          </div>
        </KvBlock>
      )}

      {Object.keys(route.parameters).length > 0 && (
        <KvBlock title="Parameters">
          {Object.entries(route.parameters).map(([k, v]) => (
            <Kv key={k} k={k} v={typeof v === "string" ? v : JSON.stringify(v)} mono />
          ))}
        </KvBlock>
      )}
    </div>
  );
}

function QueriesPanel({ queries }: { queries: NonNullable<ProfileV1["queries"]> }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-2">
        <StatPill label="Total" value={queries.total_count} />
        <StatPill label="Time" value={`${queries.total_time_ms.toFixed(1)} ms`} />
        <StatPill label="Slow" value={queries.slow_count} tone={queries.slow_count > 0 ? "danger" : "neutral"} />
        <StatPill label="Duplicates" value={queries.duplicate_count} tone={queries.duplicate_count > 0 ? "warn" : "neutral"} />
      </div>
      <ul className="space-y-1.5">
        {queries.items.map((q, i) => (
          <li key={i} className="rounded-md border border-dashboard-border bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="font-mono">{q.connection}</span>
              <span>·</span>
              <span className="font-mono tabular-nums">{q.time_ms.toFixed(2)} ms</span>
              {q.is_slow && <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">slow</Badge>}
              {q.is_duplicate && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">×{q.duplicate_count}</Badge>}
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground">{q.bound_sql}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CachePanel({ cache }: { cache: NonNullable<ProfileV1["cache"]> }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-2">
        <StatPill label="Hits" value={cache.hits} tone="ok" />
        <StatPill label="Misses" value={cache.misses} tone={cache.misses > 0 ? "warn" : "neutral"} />
        <StatPill label="Writes" value={cache.writes} />
        <StatPill label="Deletes" value={cache.deletes} />
        <StatPill label="Hit ratio" value={`${cache.hit_ratio}%`} />
      </div>
      <Table headers={["Type", "Key", "Store"]}>
        {cache.operations.map((op, i) => (
          <tr key={i} className="border-t border-dashboard-border">
            <td className="px-2 py-1.5">
              <Badge variant={op.type === "miss" ? "destructive" : "secondary"} className="h-4 px-1.5 text-[10px]">{op.type}</Badge>
            </td>
            <td className="px-2 py-1.5 font-mono">{op.key}</td>
            <td className="px-2 py-1.5 font-mono text-muted-foreground">{op.store ?? "—"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function MailPanel({ mail }: { mail: NonNullable<ProfileV1["mail"]> }) {
  return (
    <div className="space-y-3 text-xs">
      {mail.messages.map((m, i) => (
        <div key={i} className="rounded-md border border-dashboard-border bg-muted/30 p-3">
          <div className="font-medium text-foreground">{m.subject || "(no subject)"}</div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
            <Kv k="From" v={m.from.join(", ") || "—"} />
            <Kv k="To" v={m.to.join(", ") || "—"} />
            {m.cc.length > 0 && <Kv k="CC" v={m.cc.join(", ")} />}
            {m.bcc.length > 0 && <Kv k="BCC" v={m.bcc.join(", ")} />}
          </div>
          {m.body_excerpt && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-[11px]">{m.body_excerpt}</pre>}
        </div>
      ))}
    </div>
  );
}

function EventsPanel({ events }: { events: NonNullable<ProfileV1["events"]> }) {
  const rows = Object.entries(events.byName).sort((a, b) => b[1].count - a[1].count);
  return (
    <div className="text-xs">
      <Table headers={["Event", "Count", "Listeners", "Total ms"]}>
        {rows.map(([name, e]) => (
          <tr key={name} className="border-t border-dashboard-border">
            <td className="px-2 py-1.5 font-mono break-all">{name}</td>
            <td className="px-2 py-1.5 tabular-nums">{e.count}</td>
            <td className="px-2 py-1.5 tabular-nums">{e.listeners}</td>
            <td className="px-2 py-1.5 tabular-nums">{e.total_duration_ms.toFixed(2)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function ViewsPanel({ views }: { views: NonNullable<ProfileV1["views"]> }) {
  return (
    <div className="space-y-2 text-xs">
      {views.items.map((v, i) => (
        <div key={i} className="rounded-md border border-dashboard-border bg-muted/30 p-3">
          <div className="font-mono text-foreground">{v.name}</div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{v.path}</div>
          {v.data_keys.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {v.data_keys.map((k) => (
                <Badge key={k} variant="secondary" className="h-4 px-1.5 font-mono text-[10px]">{k}</Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GatesPanel({ gates }: { gates: NonNullable<ProfileV1["gates"]> }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-2">
        <StatPill label="Allowed" value={gates.allowed_count} tone="ok" />
        <StatPill label="Denied" value={gates.denied_count} tone={gates.denied_count > 0 ? "danger" : "neutral"} />
      </div>
      <Table headers={["Ability", "Result", "User", "Args"]}>
        {gates.checks.map((c, i) => (
          <tr key={i} className="border-t border-dashboard-border">
            <td className="px-2 py-1.5 font-mono">{c.ability}</td>
            <td className="px-2 py-1.5">
              <Badge variant={c.result ? "secondary" : "destructive"} className="h-4 px-1.5 text-[10px]">
                {c.result ? "allow" : "deny"}
              </Badge>
            </td>
            <td className="px-2 py-1.5 font-mono">{c.user ?? "—"}</td>
            <td className="px-2 py-1.5 font-mono text-muted-foreground">{c.arguments_classes.join(", ") || "—"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function HttpClientPanel({ http }: { http: NonNullable<ProfileV1["http_client"]> }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-2">
        <StatPill label="Total" value={http.total_count} />
        <StatPill label="Time" value={`${http.total_duration_ms.toFixed(1)} ms`} />
      </div>
      <Table headers={["Method", "URL", "Status", "ms"]}>
        {http.requests.map((r, i) => (
          <tr key={i} className="border-t border-dashboard-border">
            <td className="px-2 py-1.5 font-mono">{r.method}</td>
            <td className="px-2 py-1.5 font-mono break-all">{r.url}</td>
            <td className="px-2 py-1.5">
              <Badge
                variant={r.status_code === 0 || r.status_code >= 400 ? "destructive" : "secondary"}
                className="h-4 px-1.5 text-[10px]"
              >
                {r.status_code || "fail"}
              </Badge>
            </td>
            <td className="px-2 py-1.5 tabular-nums">{r.duration_ms.toFixed(1)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function LogsPanel({ logs }: { logs: NonNullable<ProfileV1["logs"]> }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-2">
        {Object.entries(logs.counts_by_level).map(([level, count]) => (
          <StatPill key={level} label={level} value={count} tone={isErrorLevel(level) ? "danger" : "neutral"} />
        ))}
      </div>
      {logs.items.map((l, i) => (
        <div key={i} className="rounded-md border border-dashboard-border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Badge variant={isErrorLevel(l.level) ? "destructive" : "secondary"} className="h-4 px-1.5 text-[10px] uppercase">
              {l.level}
            </Badge>
            <span className="break-words font-mono text-[11px] text-foreground">{l.message}</span>
          </div>
          {Object.keys(l.context).length > 0 && (
            <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-[10px]">{JSON.stringify(l.context, null, 2)}</pre>
          )}
        </div>
      ))}
    </div>
  );
}

function JobsPanel({ jobs }: { jobs: NonNullable<ProfileV1["jobs"]> }) {
  return (
    <div className="text-xs">
      <Table headers={["Queue", "Class", "Status", "ms"]}>
        {jobs.items.map((j, i) => (
          <tr key={i} className="border-t border-dashboard-border">
            <td className="px-2 py-1.5 font-mono">{j.queue}</td>
            <td className="px-2 py-1.5 font-mono break-all">{j.class}</td>
            <td className="px-2 py-1.5">
              <Badge variant={j.status === "failed" ? "destructive" : "secondary"} className="h-4 px-1.5 text-[10px]">
                {j.status}
              </Badge>
            </td>
            <td className="px-2 py-1.5 tabular-nums">{j.duration_ms.toFixed(1)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function MemoryPanel({ memory }: { memory: NonNullable<ProfileV1["memory"]> }) {
  const peakMb = memory.peak_bytes / 1024 / 1024;
  const limitMb = memory.limit_bytes > 0 ? memory.limit_bytes / 1024 / 1024 : null;
  const ratioPct = Math.round(memory.usage_ratio * 100);
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Peak" value={`${peakMb.toFixed(1)} MB`} mono />
        <Stat label="Limit" value={limitMb ? `${limitMb.toFixed(0)} MB` : "no limit"} mono />
        <Stat label="Usage" value={`${ratioPct}%`} mono accent={ratioPct > 80 ? "danger" : undefined} />
        {memory.opcache_mb !== null && <Stat label="Opcache" value={`${memory.opcache_mb} MB`} mono />}
      </div>
      {limitMb && (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Usage</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full transition-all", ratioPct > 80 ? "bg-destructive" : "bg-foreground")}
              style={{ width: `${Math.min(ratioPct, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TimingPanel({ timing }: { timing: NonNullable<ProfileV1["timing"]> }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total duration" value={`${timing.duration_ms.toFixed(1)} ms`} mono />
      </div>
      {Object.keys(timing.events).length > 0 && (
        <Table headers={["Event", "Start ms", "Duration ms"]}>
          {Object.entries(timing.events).map(([name, e]) => (
            <tr key={name} className="border-t border-dashboard-border">
              <td className="px-2 py-1.5 font-mono">{name}</td>
              <td className="px-2 py-1.5 tabular-nums">{e.start.toFixed(2)}</td>
              <td className="px-2 py-1.5 tabular-nums">{e.duration.toFixed(2)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────────────
function KvBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Kv({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="w-32 shrink-0 text-muted-foreground">{k}</div>
      <div className={cn("min-w-0 break-all text-foreground", mono && "font-mono")}>{v}</div>
    </div>
  );
}

function Stat({ label, value, accent, mono = false }: { label: string; value: string; accent?: "danger"; mono?: boolean }) {
  return (
    <div className="rounded-md border border-dashboard-border bg-muted/30 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-base font-medium tabular-nums", mono && "font-mono", accent === "danger" && "text-destructive")}>
        {value}
      </div>
    </div>
  );
}

function StatPill({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "ok" | "warn" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium",
        tone === "danger" && "border-destructive/40 bg-destructive/5 text-destructive",
        tone === "warn" && "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
        tone === "ok" && "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
        tone === "neutral" && "border-dashboard-border bg-muted/40 text-muted-foreground",
      )}
    >
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{value}</span>
    </span>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-dashboard-border">
      <table className="min-w-full text-[11px]">
        <thead>
          <tr className="bg-muted">
            {headers.map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-12 text-center text-sm text-muted-foreground">{children}</p>;
}

function isErrorLevel(level: string): boolean {
  return ["error", "critical", "alert", "emergency"].includes(level);
}
