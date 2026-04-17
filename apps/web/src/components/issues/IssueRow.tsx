"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  Clock,
  FileCode2,
  ExternalLink,
  CheckCircle,
  XCircle,
  PlayCircle,
} from "lucide-react";
import type { ErrorLevel } from "@/server/api";
import { useTranslations, useLocale } from "next-intl";

interface IssueRowProps {
  fingerprint: string;
  message: string;
  file: string;
  line: number;
  level: ErrorLevel;
  count: number;
  lastSeen: Date | string;
  orgSlug: string;
  maxCount: number; // For calculating relative strength
  hasReplay?: boolean;
  className?: string;
}

const levelStyles: Record<
  ErrorLevel,
  { color: string; bgColor: string; textColor: string }
> = {
  fatal: {
    color: "bg-signal-fatal",
    bgColor: "bg-signal-fatal/10",
    textColor: "text-signal-fatal",
  },
  error: {
    color: "bg-signal-error",
    bgColor: "bg-signal-error/10",
    textColor: "text-signal-error",
  },
  warning: {
    color: "bg-signal-warning",
    bgColor: "bg-signal-warning/10",
    textColor: "text-signal-warning",
  },
  info: {
    color: "bg-signal-info",
    bgColor: "bg-signal-info/10",
    textColor: "text-signal-info",
  },
  debug: {
    color: "bg-signal-debug",
    bgColor: "bg-signal-debug/10",
    textColor: "text-signal-debug",
  },
};

function formatTimeAgo(date: string | Date, locale: string, nowLabel: string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return nowLabel;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return then.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function formatFilePath(path: string): { dir: string; file: string } {
  const parts = path.split("/");
  const file = parts.pop() || path;
  const dir =
    parts.length > 2 ? `.../${parts.slice(-2).join("/")}` : parts.join("/");
  return { dir: dir ? `${dir}/` : "", file };
}

export function IssueRow({
  fingerprint,
  message,
  file,
  line,
  level,
  count,
  lastSeen,
  orgSlug,
  maxCount,
  hasReplay,
  className,
}: IssueRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = useTranslations("issues.row");
  const tSeverity = useTranslations("issues.severity");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const styles = levelStyles[level];
  const severityLabel = level === "warning" ? tSeverity("warningShort") : tSeverity(level);
  const { dir, file: fileName } = formatFilePath(file);

  // Calculate signal strength (0-100%)
  const strength = Math.min(100, (count / maxCount) * 100);

  const isCritical = level === "fatal" || level === "error";

  return (
    <div
      className={cn(
        "group border-b border-issues-border transition-colors",
        "hover:bg-issues-surface/50",
        isExpanded && "bg-issues-surface/30",
        className
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Expand toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-issues-surface hover:text-foreground"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Signal indicator */}
        <div className="flex w-20 shrink-0 items-center gap-2">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              styles.color,
              isCritical && "animate-pulse"
            )}
          />
          <span
            className={cn(
              "font-mono text-[10px] font-semibold uppercase tracking-wider",
              styles.textColor
            )}
          >
            {severityLabel}
          </span>
        </div>

        {/* Message - truncate only below 1280px (xl breakpoint) */}
        <div className="min-w-0 flex-1 overflow-hidden max-w-[200px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[500px] xl:max-w-none xl:overflow-visible">
          <Link
            href={`/dashboard/${orgSlug}/issues/${fingerprint}`}
            className="block truncate xl:whitespace-normal font-mono text-sm text-foreground hover:text-pulse-primary"
            title={message}
          >
            {message}
          </Link>
        </div>

        {/* Signal strength bar */}
        <div className="hidden w-24 shrink-0 lg:block">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-issues-border">
            <div
              className={cn("h-full rounded-full transition-all", styles.color)}
              style={{ width: `${strength}%` }}
            />
          </div>
        </div>

        {/* Source */}
        <div className="hidden w-40 shrink-0 items-center gap-1.5 text-xs md:flex">
          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <span className="truncate font-mono text-muted-foreground">
            <span className="text-muted-foreground/60">{dir}</span>
            <span className="text-pulse-muted">{fileName}</span>
            <span className="text-muted-foreground/40">:</span>
            <span className="text-pulse-primary">{line}</span>
          </span>
        </div>

        {/* Replay badge */}
        <div className="hidden w-10 shrink-0 items-center justify-center sm:flex">
          {hasReplay && (
            <div className="flex items-center gap-1 rounded-full bg-pulse-primary/10 px-2 py-0.5 text-xs font-medium text-pulse-primary">
              <PlayCircle className="h-3 w-3 fill-current" />
            </div>
          )}
        </div>

        {/* Frequency */}
        <div className="flex w-16 shrink-0 flex-col items-end">
          <span className="font-mono text-sm font-semibold text-foreground">
            {count.toLocaleString()}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {t("events")}
          </span>
        </div>

        {/* Last seen */}
        <div className="hidden w-16 shrink-0 flex-col items-end sm:flex">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{formatTimeAgo(lastSeen, locale, tCommon("now"))}</span>
          </div>
        </div>

        {/* Arrow */}
        <Link
          href={`/dashboard/${orgSlug}/issues/${fingerprint}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-pulse-primary/10 hover:text-pulse-primary group-hover:opacity-100"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-issues-border bg-issues-surface/20 px-4 py-4 pl-14">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Full message */}
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("fullMessage")}
              </h4>
              <p className="rounded-md bg-issues-bg p-3 font-mono text-sm text-foreground">
                {message}
              </p>
            </div>

            {/* Quick actions */}
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("quickActions")}
              </h4>
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center gap-1.5 rounded-md border border-signal-info/30 bg-signal-info/10 px-3 py-1.5 text-sm text-signal-info transition-colors hover:bg-signal-info/20">
                  <CheckCircle className="h-4 w-4" />
                  {t("resolve")}
                </button>
                <button className="flex items-center gap-1.5 rounded-md border border-muted-foreground/30 bg-muted/10 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/20">
                  <XCircle className="h-4 w-4" />
                  {t("ignore")}
                </button>
                <Link
                  href={`/dashboard/${orgSlug}/issues/${fingerprint}`}
                  className="flex items-center gap-1.5 rounded-md border border-pulse-primary/30 bg-pulse-primary/10 px-3 py-1.5 text-sm text-pulse-primary transition-colors hover:bg-pulse-primary/20"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("viewDetails")}
                </Link>
              </div>
            </div>
          </div>

          {/* File location */}
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("sourceLocation")}
            </h4>
            <code className="rounded-md bg-issues-bg px-3 py-2 font-mono text-sm text-pulse-muted">
              {file}:{line}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
