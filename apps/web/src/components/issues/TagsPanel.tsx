"use client";

import { cn } from "@/lib/utils";
import { Tag } from "lucide-react";
import { useTranslations } from "next-intl";

interface TagsPanelProps {
  tags?: Record<string, string>;
  onTagClick?: (tag: string, value: string) => void;
  className?: string;
}

const TAG_COLORS: Record<string, string> = {
  env: "bg-signal-fatal/10 text-signal-fatal border-signal-fatal/30",
  environment: "bg-signal-fatal/10 text-signal-fatal border-signal-fatal/30",
  level: "bg-signal-warning/10 text-signal-warning border-signal-warning/30",
  release: "bg-pulse-primary/10 text-pulse-primary border-pulse-primary/30",
  version: "bg-pulse-primary/10 text-pulse-primary border-pulse-primary/30",
};

function getTagColor(key: string): string {
  return TAG_COLORS[key.toLowerCase()] ?? "bg-issues-bg/50 text-foreground border-issues-border";
}

export function TagsPanel({ tags, onTagClick, className }: TagsPanelProps) {
  const t = useTranslations("issueDetail.tagsPanel");

  if (!tags || Object.keys(tags).length === 0) {
    return null;
  }

  const entries = Object.entries(tags);

  return (
    <div
      className={cn(
        "rounded-lg border border-issues-border bg-issues-surface/30 p-4",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
          {t("title")}
        </h3>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {entries.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => (
          <button
            key={key}
            onClick={() => onTagClick?.(key, value)}
            disabled={!onTagClick}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-left transition-colors",
              getTagColor(key),
              onTagClick && "hover:opacity-80 cursor-pointer"
            )}
          >
            <span className="font-mono text-[10px] font-medium opacity-70">{key}</span>
            <span className="text-[10px] opacity-30">·</span>
            <span className="font-mono text-[10px] font-semibold">{value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
