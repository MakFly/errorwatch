"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface Release {
  version: string;
  count: number;
  percentage: number;
}

interface ContextCardsProps {
  env?: string;
  contexts?: {
    os?: { name?: string; version?: string };
    browser?: { name?: string; version?: string };
    runtime?: { name?: string; version?: string };
    [key: string]: unknown;
  };
  releases?: Release[];
  firstSeenIn?: string | null;
  className?: string;
}

const envColors: Record<string, string> = {
  prod: "bg-signal-error/15 text-signal-error border-signal-error/30",
  production: "bg-signal-error/15 text-signal-error border-signal-error/30",
  staging: "bg-signal-warning/15 text-signal-warning border-signal-warning/30",
  dev: "bg-signal-info/15 text-signal-info border-signal-info/30",
  development: "bg-signal-info/15 text-signal-info border-signal-info/30",
  test: "bg-muted/30 text-muted-foreground border-dashboard-border",
  local: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

function Row({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-dashboard-border/40 px-6 py-2.5 font-mono text-sm last:border-0 md:px-8">
      <span className="w-32 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-foreground", valueClass)}>{value}</span>
    </div>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="border-b border-dashboard-border/60 bg-muted/10 px-6 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground md:px-8">
      {title}
    </div>
  );
}

export function ContextCards({
  env,
  contexts,
  releases,
  firstSeenIn,
  className,
}: ContextCardsProps) {
  const t = useTranslations("issueDetail.contextCards");

  const hasBrowserOrOs = contexts?.browser?.name || contexts?.os?.name;
  const hasRuntime = contexts?.runtime?.name;
  const hasRelease = releases && releases.length > 0;
  const hasAnything = env || hasBrowserOrOs || hasRuntime || hasRelease;

  if (!hasAnything) {
    return (
      <p className={cn("px-6 py-8 text-center text-sm italic text-muted-foreground md:px-8", className)}>
        {t("noContext")}
      </p>
    );
  }

  const envColorClass = env ? envColors[env] ?? "bg-muted/30 text-muted-foreground border-dashboard-border" : "";

  return (
    <div className={cn("flex flex-col", className)}>
      {env && (
        <>
          <SectionHead title={t("environment")} />
          <div className="flex items-center gap-2 border-b border-dashboard-border/40 px-6 py-3 md:px-8">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm font-semibold",
                envColorClass
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full bg-current")} />
              {env}
            </span>
          </div>
        </>
      )}

      {hasBrowserOrOs && (
        <>
          <SectionHead title={t("device")} />
          {contexts?.browser?.name && (
            <Row
              label={t("browser")}
              value={contexts.browser.version ? `${contexts.browser.name} ${contexts.browser.version}` : contexts.browser.name}
            />
          )}
          {contexts?.os?.name && (
            <Row
              label={t("os")}
              value={contexts.os.version ? `${contexts.os.name} ${contexts.os.version}` : contexts.os.name}
            />
          )}
        </>
      )}

      {hasRuntime && (
        <>
          <SectionHead title={t("runtime")} />
          <Row
            label={contexts!.runtime!.name!}
            value={contexts!.runtime!.version ?? "—"}
          />
        </>
      )}

      {hasRelease && (
        <>
          <SectionHead title={t("release")} />
          {firstSeenIn && firstSeenIn !== "unknown" && (
            <Row label={t("firstSeenIn")} value={firstSeenIn} valueClass="text-pulse-primary font-semibold" />
          )}
          {releases!.slice(0, 5).map((release) => (
            <div
              key={release.version}
              className="flex items-center gap-4 border-b border-dashboard-border/40 px-6 py-2.5 font-mono text-sm last:border-0 md:px-8"
            >
              <span className="w-32 shrink-0 truncate text-foreground">{release.version}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/20">
                <div className="h-full rounded-full bg-pulse-primary" style={{ width: `${release.percentage}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {release.percentage}%
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
