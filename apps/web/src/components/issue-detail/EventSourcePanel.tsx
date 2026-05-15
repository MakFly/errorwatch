"use client";

import { Globe, Terminal, Cog, Cpu, Server, Hash, FileCode, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ErrorEvent } from "@/server/api";

type Source = "http" | "cli" | "worker" | "scheduler" | "boot" | "unknown";

interface SourceBadge {
  label: string;
  description: string;
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const SOURCES: Record<Source, SourceBadge> = {
  http: {
    label: "HTTP",
    description: "Captured during an HTTP request",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    Icon: Globe,
  },
  cli: {
    label: "CLI",
    description: "Emitted by an Artisan command or CLI script",
    className: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    Icon: Terminal,
  },
  worker: {
    label: "Worker",
    description: "Emitted by a queue worker",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    Icon: Cog,
  },
  scheduler: {
    label: "Scheduler",
    description: "Emitted by a scheduled task",
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    Icon: Cog,
  },
  boot: {
    label: "Boot",
    description: "Captured during framework bootstrap (no request context)",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    Icon: Cpu,
  },
  unknown: {
    label: "Process",
    description: "Source could not be determined",
    className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
    Icon: Cpu,
  },
};

/**
 * Parse the trailing "in <file> on line <N>" pattern emitted by the PHP error
 * formatter for deprecations / warnings — gives us a free origin pointer
 * even when the SDK didn't send frames or extra.origin_file.
 */
function extractOriginFromMessage(message: string | null | undefined): { file: string; line: number } | null {
  if (!message) return null;
  const m = message.match(/ in (\S+\.\w+) on line (\d+)\b/);
  if (!m) return null;
  return { file: m[1], line: Number(m[2]) };
}

function detectSource(event: ErrorEvent): Source {
  const sapi = (event.contexts as { runtime?: { sapi?: string } })?.runtime?.sapi?.toLowerCase();
  const hasRequest = Boolean(event.request?.method || event.url);
  const ctx = event.extra as { laravel_log_context?: { channel?: string } } | undefined;
  const channel = ctx?.laravel_log_context?.channel;

  if (hasRequest && (!sapi || sapi !== "cli")) return "http";
  if (sapi === "cli") {
    if (channel === "queue" || channel === "horizon") return "worker";
    if (channel === "schedule") return "scheduler";
    if (!hasRequest) return "cli";
  }
  if (!hasRequest && !sapi) return "boot";
  return "unknown";
}

interface KVProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

function KV({ label, value, mono }: KVProps) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-baseline gap-3 border-b border-dashboard-border/60 py-2 last:border-0">
      <dt className="w-32 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("min-w-0 flex-1 break-all text-sm text-foreground", mono && "font-mono")}>
        {value}
      </dd>
    </div>
  );
}

export function EventSourcePanel({ event }: { event: ErrorEvent }) {
  const source = detectSource(event);
  const badge = SOURCES[source];
  const SourceIcon = badge.Icon;

  const runtime = (event.contexts as { runtime?: { name?: string; version?: string; sapi?: string } })?.runtime;
  const os = (event.contexts as { os?: { name?: string; release?: string } })?.os;
  const extra = event.extra as
    | {
        laravel_log_context?: { channel?: string };
        origin_file?: string;
        origin_line?: number;
      }
    | undefined;
  const channel = extra?.laravel_log_context?.channel;
  // Prefer SDK-provided origin (v2.5.3+) but fall back to parsing the
  // message tail so events captured by older SDKs still surface a pointer.
  const sdkOriginFile = extra?.origin_file;
  const sdkOriginLine = extra?.origin_line;
  const messageOrigin = !sdkOriginFile
    ? extractOriginFromMessage(event.exceptionValue ?? event.stack ?? null)
    : null;
  const originFile = sdkOriginFile ?? messageOrigin?.file;
  const originLine = sdkOriginLine ?? messageOrigin?.line;

  // SDK ships Sentry-style frames (oldest -> newest). Top of the stack is the
  // last in-app frame; we surface the deepest 5 reversed so newest is on top.
  const topFrames = (event.frames ?? []).slice(-5).reverse();

  return (
    <div className="grid h-full min-h-full grid-cols-1 gap-px bg-dashboard-border md:grid-cols-[260px_1fr]">
      {/* ── Left rail : source label ─────────────────────────────────────────── */}
      <aside className="bg-dashboard-surface px-5 py-6">
        <div className={cn("inline-flex items-center gap-2 rounded-sm px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider", badge.className)}>
          <SourceIcon className="h-3.5 w-3.5" />
          {badge.label}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{badge.description}</p>
        <p className="mt-4 max-w-xs text-[11px] leading-relaxed text-muted-foreground/80">
          The full request profile (queries, cache, jobs, mail…) is only captured for events that
          flow through an HTTP request. CLI / worker / boot-time events show this lighter source
          summary instead.
        </p>
      </aside>

      {/* ── Right column : details ───────────────────────────────────────────── */}
      <section className="bg-background p-5 md:p-6">
        <header className="mb-4 flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
            Process info
          </h2>
        </header>

        {(originFile || event.url) && (
          <div className="mb-4 rounded-sm border border-dashboard-border bg-dashboard-surface p-3">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Origin
            </div>
            <div className="break-all font-mono text-sm text-foreground">
              {originFile ? (
                <>
                  <span className="text-signal-error">{originFile}</span>
                  {originLine != null && <span className="text-muted-foreground">:</span>}
                  {originLine != null && <span className="text-signal-warning">{originLine}</span>}
                </>
              ) : (
                <span>{event.url}</span>
              )}
            </div>
          </div>
        )}

        <dl>
          <KV label="Environment" value={event.env} mono />
          {event.serverName && <KV label="Server" value={event.serverName} mono />}
          <KV label="Platform" value={event.platform} mono />
          {runtime && (
            <KV
              label="Runtime"
              value={
                <span>
                  {runtime.name} {runtime.version}
                  {runtime.sapi && (
                    <span className="ml-2 inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      sapi: {runtime.sapi}
                    </span>
                  )}
                </span>
              }
              mono
            />
          )}
          {os && <KV label="OS" value={`${os.name ?? "?"} ${os.release ?? ""}`.trim()} mono />}
          {event.sdk && <KV label="SDK" value={`${event.sdk.name} v${event.sdk.version}`} mono />}
          {channel && <KV label="Log channel" value={channel} mono />}
          {event.release && <KV label="Release" value={event.release} mono />}
          {event.traceId && <KV label="Trace ID" value={event.traceId} mono />}
          <KV label="Captured at" value={new Date(event.createdAt).toLocaleString()} mono />
          <KV label="Event ID" value={<span className="opacity-70">{event.id}</span>} mono />
        </dl>

        {topFrames.length > 0 && (
          <div className="mt-6">
            <header className="mb-2 flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
                Top frames
              </h3>
            </header>
            <ol className="space-y-1.5 font-mono text-xs">
              {topFrames.map((frame, i) => (
                <li
                  key={`${frame.filename}:${frame.lineno}:${i}`}
                  className={cn(
                    "flex items-baseline gap-3 rounded-sm border border-dashboard-border bg-dashboard-surface px-3 py-1.5",
                    frame.in_app && "border-l-2 border-l-signal-error",
                  )}
                >
                  <FileCode className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">
                      {frame.function ? (
                        <span className="text-signal-info">{frame.function}</span>
                      ) : (
                        <span className="text-muted-foreground">&lt;closure&gt;</span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {frame.filename}
                      {frame.lineno != null && `:${frame.lineno}`}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {event.stack && topFrames.length === 0 && (
          <div className="mt-6">
            <header className="mb-2 flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
                Stack trace
              </h3>
            </header>
            <pre className="max-h-96 overflow-auto rounded-sm border border-dashboard-border bg-dashboard-surface p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {event.stack}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
