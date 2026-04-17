"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";

interface EventData {
  id: string;
  sessionId: string | null;
  createdAt: Date | string;
  url: string | null;
  stack: string | null;
}

interface EventListSidebarProps {
  events: EventData[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  orgSlug: string;
  projectSlug: string;
  className?: string;
}

function formatRelative(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatTimeShort(date: Date | string): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getUrlPath(url: string | null): string {
  if (!url) return "—";
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url.slice(0, 40);
  }
}

export function EventListSidebar({
  events,
  selectedEventId,
  onSelectEvent,
  orgSlug,
  projectSlug,
  className,
}: EventListSidebarProps) {
  const t = useTranslations("issueDetail.navigator");

  return (
    <aside className={cn("flex flex-col", className)}>
      <div className="border-b border-dashboard-border/60 px-4 py-3">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title", { count: events.length })}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("noEvents")}</p>
        ) : (
          events.map((event) => {
            const isSelected = event.id === selectedEventId;
            const hasReplay = !!event.sessionId;

            return (
              <button
                key={event.id}
                onClick={() => onSelectEvent(event.id)}
                className={cn(
                  "flex w-full flex-col gap-1 border-b border-dashboard-border/40 border-l-2 px-4 py-2.5 text-left transition-colors",
                  isSelected
                    ? "border-l-pulse-primary bg-pulse-primary/5"
                    : "border-l-transparent hover:bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between gap-2 font-mono text-sm">
                  <span className={cn(isSelected ? "font-semibold text-foreground" : "text-foreground/80")}>
                    {formatTimeShort(event.createdAt)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(event.createdAt)}
                  </span>
                </div>
                <code className="truncate font-mono text-xs text-muted-foreground">
                  {getUrlPath(event.url)}
                </code>
                {hasReplay && (
                  <Link
                    href={`/dashboard/${orgSlug}/${projectSlug}/replays/${event.sessionId}?errorTime=${new Date(event.createdAt).toISOString()}&errorEventId=${event.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 inline-flex w-fit items-center gap-1 font-mono text-xs font-semibold text-pulse-primary hover:text-pulse-primary/80"
                  >
                    <Play className="h-2.5 w-2.5 fill-current" />
                    {t("replay")}
                  </Link>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
