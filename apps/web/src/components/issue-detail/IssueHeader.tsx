"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Check,
  User,
} from "lucide-react";
import { useState, useRef } from "react";
import type { ErrorLevel } from "@/server/api";
import { useTranslations } from "next-intl";

const levelStyles: Record<ErrorLevel, string> = {
  fatal: "bg-signal-fatal/20 text-signal-fatal border-signal-fatal/50",
  error: "bg-signal-error/20 text-signal-error border-signal-error/50",
  warning: "bg-signal-warning/20 text-signal-warning border-signal-warning/50",
  info: "bg-signal-info/20 text-signal-info border-signal-info/50",
  debug: "bg-signal-debug/20 text-signal-debug border-signal-debug/50",
};

interface Member {
  id: string;
  name: string | null;
  email?: string;
  image?: string | null;
}

interface IssueHeaderProps {
  message: string;
  file: string;
  line: number;
  level: ErrorLevel;
  statusCode?: number | null;
  orgSlug: string;
  projectSlug: string;
  // Assignment
  assignedTo?: string | null;
  members?: Member[];
  onAssign?: (userId: string | null) => void;
  isAssigning?: boolean;
}

// Parse exception type from message (e.g., "TypeError: Cannot read property 'x'")
function parseExceptionType(message: string): { type: string | null; cleanMessage: string } {
  // Match common exception patterns: TypeError, Error, Exception, etc.
  const match = message.match(/^(\w+(?:Error|Exception|Fault)):\s*([\s\S]*)$/);
  if (match) {
    return { type: match[1], cleanMessage: match[2] };
  }
  // Also match PHP-style: "Uncaught TypeError: ..."
  const uncaughtMatch = message.match(/^(?:Uncaught\s+)?(\w+(?:Error|Exception)):\s*([\s\S]*)$/);
  if (uncaughtMatch) {
    return { type: uncaughtMatch[1], cleanMessage: uncaughtMatch[2] };
  }
  return { type: null, cleanMessage: message };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const tCommon = useTranslations("common");

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded hover:bg-issues-surface transition-colors"
      title={tCommon("copyToClipboard")}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-signal-info" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
      )}
    </button>
  );
}

function AssigneeButton({
  assignedTo,
  members = [],
  onAssign,
  isLoading
}: {
  assignedTo?: string | null;
  members?: Member[];
  onAssign?: (userId: string | null) => void;
  isLoading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("issueDetail.header");
  const assignee = members.find(m => m.id === assignedTo);

  if (!onAssign) return null;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!open) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(!open);
  };

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleClick}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all",
            "font-mono text-xs",
            assignee
              ? "bg-pulse-primary/10 border-pulse-primary/30 text-pulse-primary"
              : "bg-issues-surface border-issues-border text-muted-foreground hover:border-issues-border/80"
          )}
        >
          <User className="h-3.5 w-3.5" />
          <span>{assignee?.name || t("assign")}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {open && position && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-48 rounded-lg border border-issues-border bg-issues-bg shadow-xl overflow-hidden"
            style={{
              top: `${position.top}px`,
              right: `${position.right}px`,
            }}
          >
            {assignee && (
              <button
                onClick={() => { onAssign(null); setOpen(false); }}
                className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-issues-surface border-b border-issues-border"
              >
                {t("unassign")}
              </button>
            )}
            {members.map(m => (
              <button
                key={m.id}
                onClick={() => { onAssign(m.id); setOpen(false); }}
                className={cn(
                  "w-full px-3 py-2 text-left text-xs hover:bg-issues-surface flex items-center gap-2",
                  m.id === assignedTo ? "text-pulse-primary" : "text-foreground"
                )}
              >
                <div className="h-5 w-5 rounded-full bg-issues-surface flex items-center justify-center text-[10px] font-bold">
                  {m.name?.charAt(0) || "?"}
                </div>
                {m.name || m.email || "Unknown"}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function IssueHeader({
  message,
  file,
  line,
  level,
  statusCode,
  orgSlug,
  projectSlug,
  assignedTo,
  members = [],
  onAssign,
  isAssigning,
}: IssueHeaderProps) {
  const t = useTranslations("issueDetail.header");
  const tSeverity = useTranslations("issues.severity");
  const levelLabel = tSeverity(level);
  const levelClass = levelStyles[level];
  const { type: exceptionType, cleanMessage } = parseExceptionType(message);

  return (
    <div className="relative">
      <div className="rounded-xl border border-issues-border bg-issues-surface overflow-hidden">
        {/* Top accent line */}
        <div className={cn(
          "h-0.5",
          level === "fatal" && "bg-signal-fatal",
          level === "error" && "bg-signal-error",
          level === "warning" && "bg-signal-warning",
          level === "info" && "bg-signal-info",
          level === "debug" && "bg-signal-debug",
        )} />

        <div className="p-6">
          {/* Navigation + Level */}
          <div className="flex items-center gap-4 mb-4">
            <Link
              href={`/dashboard/${orgSlug}/${projectSlug}/issues`}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="font-mono">{t("issues")}</span>
            </Link>

            <span className={cn(
              "px-2 py-0.5 rounded border font-mono text-xs font-bold tracking-wider uppercase",
              levelClass
            )}>
              {statusCode ? `${statusCode} ${levelLabel}` : levelLabel}
            </span>
          </div>

          {/* Error message */}
          <div className="mb-3">
            {exceptionType && (
              <span className="inline-block px-2 py-0.5 rounded border font-mono text-xs font-bold tracking-wider bg-signal-error/10 text-signal-error border-signal-error/30 mb-2">
                {exceptionType}
              </span>
            )}
            <h1 className="font-mono text-lg md:text-xl font-medium text-foreground leading-relaxed tracking-tight">
              {cleanMessage}
            </h1>
          </div>

          {/* File location */}
          <div className="flex items-center gap-2 text-sm mb-6">
            <code className="font-mono text-muted-foreground">
              <span className="text-signal-info">{file}</span>
              <span className="text-muted">:</span>
              <span className="text-signal-warning">{line}</span>
            </code>
            <CopyButton text={`${file}:${line}`} />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end">
            <AssigneeButton
              assignedTo={assignedTo}
              members={members}
              onAssign={onAssign}
              isLoading={isAssigning}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
