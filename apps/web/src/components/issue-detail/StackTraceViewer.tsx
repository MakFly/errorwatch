"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Copy, Check, Code2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface StackFrame {
  file: string;
  line: number;
  column?: number;
  function: string;
  isVendor: boolean;
}

interface StackTraceViewerProps {
  stack: string;
  highlightFile?: string;
  highlightLine?: number;
  className?: string;
}

function parseStackTrace(stack: string): StackFrame[] {
  const lines = stack.split("\n");
  const frames: StackFrame[] = [];

  const patterns: Array<{ regex: RegExp; groups: { fn?: number; file: number; line: number; col?: number } }> = [
    { regex: /at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):?(\d+)?\)?/, groups: { fn: 1, file: 2, line: 3, col: 4 } },
    { regex: /^(.+?)@(.+?):(\d+):?(\d+)?$/, groups: { fn: 1, file: 2, line: 3, col: 4 } },
    { regex: /^(.+?)\s+—\s+(.+?):(\d+)$/, groups: { fn: 1, file: 2, line: 3 } },
    { regex: /async\s+(.+?)\s+\((.+?):(\d+):?(\d+)?\)/, groups: { fn: 1, file: 2, line: 3, col: 4 } },
    { regex: /#\d+\s+(.+?)\((\d+)\):\s+(.+)/, groups: { file: 1, line: 2, fn: 3 } },
    { regex: /File\s+"(.+?)",\s+line\s+(\d+),\s+in\s+(.+)/, groups: { file: 1, line: 2, fn: 3 } },
    { regex: /at\s+(.+?)\((.+?):(\d+)\)/, groups: { fn: 1, file: 2, line: 3 } },
    { regex: /^\s*(.+?):(\d+):?(\d+)?$/, groups: { file: 1, line: 2, col: 3 } },
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.match(/^(\w+Error|\w+Exception):/)) continue;

    for (const { regex, groups } of patterns) {
      const match = trimmed.match(regex);
      if (!match) continue;

      const file = match[groups.file] || "";
      const lineNum = match[groups.line];
      const fn = groups.fn ? match[groups.fn] : undefined;
      const col = groups.col ? match[groups.col] : undefined;

      if (!file || !lineNum) continue;

      const isVendor =
        file.includes("node_modules") ||
        file.includes("/vendor/") ||
        file.includes(".min.") ||
        file.includes("/dist/") ||
        file.includes("symfony/") ||
        file.includes("doctrine/");

      frames.push({
        file: file
          .replace(/^webpack:\/\/\//, "")
          .replace(/^file:\/\//, "")
          .replace(/\?.+$/, ""),
        line: parseInt(lineNum, 10),
        column: col ? parseInt(col, 10) : undefined,
        function: fn || "(anonymous)",
        isVendor,
      });
      break;
    }
  }

  return frames;
}

type Segment =
  | { kind: "frame"; frame: StackFrame; absIndex: number; highlighted: boolean }
  | { kind: "group"; frames: StackFrame[]; startIndex: number };

function groupFrames(frames: StackFrame[], highlightFile?: string, highlightLine?: number): Segment[] {
  const segments: Segment[] = [];
  let buffer: StackFrame[] = [];
  let bufferStart = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    if (buffer.length === 1) {
      segments.push({ kind: "frame", frame: buffer[0], absIndex: bufferStart, highlighted: false });
    } else {
      segments.push({ kind: "group", frames: [...buffer], startIndex: bufferStart });
    }
    buffer = [];
  };

  frames.forEach((frame, idx) => {
    const isHighlighted =
      !!highlightFile &&
      !!highlightLine &&
      frame.file.includes(highlightFile) &&
      frame.line === highlightLine;

    if (frame.isVendor && !isHighlighted) {
      if (buffer.length === 0) bufferStart = idx;
      buffer.push(frame);
    } else {
      flush();
      segments.push({ kind: "frame", frame, absIndex: idx, highlighted: isHighlighted });
    }
  });

  flush();
  return segments;
}

function FrameRow({
  frame,
  index,
  highlighted,
}: {
  frame: StackFrame;
  index: number;
  highlighted: boolean;
}) {
  const [expanded, setExpanded] = useState(highlighted);
  const [copied, setCopied] = useState(false);
  const t = useTranslations("issueDetail.stackTrace");

  const filename = frame.file.split("/").pop();

  return (
    <div
      className={cn(
        "border-b border-dashboard-border/60 font-mono last:border-0",
        highlighted && "bg-signal-fatal/5"
      )}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 px-6 py-2.5 text-left transition-colors md:px-8",
          highlighted ? "hover:bg-signal-fatal/10" : "hover:bg-muted/20"
        )}
      >
        <span className="text-muted-foreground/60">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span
          className={cn(
            "w-6 shrink-0 text-right text-xs",
            highlighted ? "text-signal-fatal font-bold" : "text-muted-foreground/60"
          )}
        >
          {index + 1}
        </span>
        <code className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm">
          <span className={cn("font-medium", highlighted ? "text-signal-fatal" : "text-signal-info")}>
            {filename}
          </span>
          <span className="text-muted-foreground/50">:</span>
          <span className={cn(highlighted ? "text-signal-fatal" : "text-signal-warning/80")}>
            {frame.line}
          </span>
          {frame.column && (
            <>
              <span className="text-muted-foreground/50">:</span>
              <span className="text-muted-foreground/70">{frame.column}</span>
            </>
          )}
          {frame.function && frame.function !== "(anonymous)" && (
            <span className="ml-3 truncate text-muted-foreground/70">in {frame.function}</span>
          )}
        </code>
        {highlighted && (
          <span className="shrink-0 rounded border border-signal-fatal/30 bg-signal-fatal/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-signal-fatal">
            {t("source")}
          </span>
        )}
      </button>

      {expanded && (
        <div className="flex items-start gap-2 pb-2 pl-[4.25rem] pr-6 pt-0 md:pr-8">
          <code className="flex-1 break-all text-xs text-muted-foreground/80">{frame.file}</code>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(`${frame.file}:${frame.line}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="shrink-0 rounded p-1 hover:bg-muted/20"
            title="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-signal-ok" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground/60" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function FrameworkGroup({
  frames,
  startIndex,
}: {
  frames: StackFrame[];
  startIndex: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("issueDetail.stackTrace");
  const label = frames.length === 1 ? t("frameworkFrames", { count: frames.length }) : t("frameworkFramesPlural", { count: frames.length });

  return (
    <div className="border-b border-dashboard-border/60 last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-6 py-2 text-left font-mono text-xs text-muted-foreground/70 transition-colors hover:bg-muted/20 md:px-8"
      >
        <span className="text-muted-foreground/60">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="italic">[+{label}]</span>
      </button>
      {expanded && (
        <div>
          {frames.map((frame, i) => (
            <FrameRow key={`${frame.file}-${frame.line}-${i}`} frame={frame} index={startIndex + i} highlighted={false} />
          ))}
        </div>
      )}
    </div>
  );
}

export function StackTraceViewer({
  stack,
  highlightFile,
  highlightLine,
  className,
}: StackTraceViewerProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = useTranslations("issueDetail.stackTrace");

  const frames = useMemo(() => parseStackTrace(stack), [stack]);
  const segments = useMemo(() => groupFrames(frames, highlightFile, highlightLine), [frames, highlightFile, highlightLine]);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between border-b border-dashboard-border px-6 py-3 md:px-8">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("title")}
          </h2>
          <span className="rounded bg-muted/20 px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {t("frames", { count: frames.length })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRaw((v) => !v)}
            className={cn(
              "rounded px-2 py-1 font-mono text-xs transition-colors",
              showRaw ? "bg-muted/30 text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {showRaw ? t("parsed") : t("raw")}
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(stack);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded p-1 hover:bg-muted/20"
            title="Copy all"
          >
            {copied ? (
              <Check className="h-4 w-4 text-signal-ok" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        </div>
      </div>

      {showRaw ? (
        <pre className="whitespace-pre-wrap break-all px-6 py-4 font-mono text-sm text-muted-foreground md:px-8">
          {stack}
        </pre>
      ) : segments.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground md:px-8">{t("noFrames")}</p>
      ) : (
        <div>
          {segments.map((seg, i) =>
            seg.kind === "frame" ? (
              <FrameRow key={i} frame={seg.frame} index={seg.absIndex} highlighted={seg.highlighted} />
            ) : (
              <FrameworkGroup key={i} frames={seg.frames} startIndex={seg.startIndex} />
            )
          )}
        </div>
      )}
    </div>
  );
}
