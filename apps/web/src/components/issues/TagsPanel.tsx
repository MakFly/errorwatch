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
  return TAG_COLORS[key.toLowerCase()] ?? "bg-muted/20 text-foreground border-dashboard-border";
}

export function TagsPanel({ tags, onTagClick, className }: TagsPanelProps) {
  const t = useTranslations("issueDetail.tagsPanel");

  if (!tags || Object.keys(tags).length === 0) return null;

  const entries = Object.entries(tags);

  return (
    <div className={cn("border-t border-dashboard-border", className)}>
      <div className="flex items-center gap-2 border-b border-dashboard-border/60 bg-muted/10 px-6 py-2 md:px-8">
        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </h3>
        <span className="font-mono text-xs text-muted-foreground/70">· {entries.length}</span>
      </div>
      <div className="flex flex-wrap gap-2 px-6 py-3 md:px-8">
        {entries.map(([key, value]) => (
          <button
            key={key}
            onClick={() => onTagClick?.(key, value)}
            disabled={!onTagClick}
            className={cn(
              "inline-flex items-baseline gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs text-left transition-opacity",
              getTagColor(key),
              onTagClick && "hover:opacity-80 cursor-pointer"
            )}
          >
            <span className="text-[10px] opacity-70">{key}</span>
            <span className="opacity-40">=</span>
            <span className="font-semibold">{value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
