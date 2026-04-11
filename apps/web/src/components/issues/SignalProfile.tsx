"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Copy,
  Check,
  FileCode2,
  Hash,
  Calendar,
  Clock,
  Activity,
} from "lucide-react";
import Sparkline from "@/components/Sparkline";
import { AssigneeDropdown } from "./AssigneeDropdown";
import type { ErrorLevel } from "@/server/api";

interface Member {
  id: string;
  name: string | null;
  email?: string;
  image?: string | null;
}

interface SignalProfileProps {
  fingerprint: string;
  message: string;
  file: string;
  line: number;
  level: ErrorLevel;
  count: number;
  firstSeen: Date | string;
  lastSeen: Date | string;
  statusCode?: number | null;
  sparklineData: number[];
  projectSlug: string;
  className?: string;
  // Assignment props
  assignedTo?: string | null;
  assignedAt?: Date | string | null;
  members?: Member[];
  onAssign?: (userId: string | null) => void;
  isAssigning?: boolean;
}

const levelConfig: Record<
  ErrorLevel,
  { label: string; color: string; bgColor: string; glowColor: string }
> = {
  fatal: {
    label: "FATAL",
    color: "text-signal-fatal",
    bgColor: "bg-signal-fatal/10",
    glowColor: "shadow-signal-fatal/30",
  },
  error: {
    label: "ERROR",
    color: "text-signal-error",
    bgColor: "bg-signal-error/10",
    glowColor: "shadow-signal-error/30",
  },
  warning: {
    label: "WARNING",
    color: "text-signal-warning",
    bgColor: "bg-signal-warning/10",
    glowColor: "shadow-signal-warning/30",
  },
  info: {
    label: "INFO",
    color: "text-signal-info",
    bgColor: "bg-signal-info/10",
    glowColor: "shadow-signal-info/30",
  },
  debug: {
    label: "DEBUG",
    color: "text-signal-debug",
    bgColor: "bg-signal-debug/10",
    glowColor: "shadow-signal-debug/30",
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-issues-surface hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-4 w-4 text-signal-info" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

export function SignalProfile({
  fingerprint,
  message,
  file,
  line,
  level,
  count,
  firstSeen,
  lastSeen,
  statusCode,
  sparklineData,
  projectSlug,
  className,
  assignedTo,
  members = [],
  onAssign,
  isAssigning,
}: SignalProfileProps) {
  const config = levelConfig[level];
  const isCritical = level === "fatal" || level === "error";

  // Find current assignee from members list
  const currentAssignee = assignedTo
    ? members.find((m) => m.id === assignedTo) || { id: assignedTo, name: null }
    : null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Back link */}
      <Link
        href={`/dashboard/${projectSlug}/issues`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Signal Deck
      </Link>

      {/* Signal Profile Panel */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-gradient-to-br from-issues-surface/80 to-issues-bg p-6",
          isCritical
            ? "border-signal-fatal/30"
            : "border-issues-border"
        )}
      >
        {/* Gradient accent line */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pulse-primary via-pulse-secondary to-pulse-primary" />

        {/* Header row */}
        <div className="mb-4 flex items-start gap-4">
          {/* Severity indicator */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "relative h-3 w-3 rounded-full",
                config.bgColor,
                isCritical && "animate-pulse"
              )}
            >
              <span
                className={cn(
                  "absolute inset-0.5 rounded-full",
                  level === "fatal" && "bg-signal-fatal",
                  level === "error" && "bg-signal-error",
                  level === "warning" && "bg-signal-warning",
                  level === "info" && "bg-signal-info",
                  level === "debug" && "bg-signal-debug"
                )}
              />
            </span>
            <span
              className={cn(
                "font-mono text-xs font-bold uppercase tracking-wider",
                config.color
              )}
            >
              {statusCode ? `${statusCode} ${config.label}` : config.label}
            </span>
          </div>
        </div>

        {/* Error message */}
        <h1 className="mb-6 font-mono text-xl font-bold leading-tight text-foreground">
          {message}
        </h1>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-issues-border bg-issues-bg/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">
                Events
              </span>
            </div>
            <p className="font-mono text-xl font-bold text-foreground">
              {count.toLocaleString()}
            </p>
          </div>

          <div className="rounded-lg border border-issues-border bg-issues-bg/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">
                First seen
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">
              {formatDate(firstSeen)}
            </p>
          </div>

          <div className="rounded-lg border border-issues-border bg-issues-bg/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">
                Last seen
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">
              {formatTimeAgo(lastSeen)}
            </p>
          </div>

          <div className="rounded-lg border border-issues-border bg-issues-bg/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">
                Trend
              </span>
            </div>
            <Sparkline
              data={sparklineData}
              width={100}
              height={28}
              color="hsl(var(--pulse-primary))"
              fillOpacity={0.2}
            />
          </div>
        </div>

        {/* Source location */}
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-issues-border bg-issues-bg/50 px-3 py-2">
          <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <code className="flex-1 truncate font-mono text-sm">
            <span className="text-pulse-primary">{file}</span>
            <span className="text-muted-foreground">:</span>
            <span className="text-pulse-secondary">{line}</span>
          </code>
          <CopyButton text={`${file}:${line}`} />
        </div>

        {/* Assignment */}
        {onAssign && members.length > 0 && (
          <div className="flex justify-end">
            <AssigneeDropdown
              currentAssignee={currentAssignee}
              members={members}
              onAssign={onAssign}
              isLoading={isAssigning}
            />
          </div>
        )}
      </div>
    </div>
  );
}
