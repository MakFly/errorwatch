"use client";

import { cn } from "@/lib/utils";
import { Server, Globe, Package, Cpu } from "lucide-react";
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

const envConfig: Record<string, { color: string; dot: string }> = {
  prod: { color: "text-signal-error", dot: "bg-signal-error" },
  production: { color: "text-signal-error", dot: "bg-signal-error" },
  staging: { color: "text-signal-warning", dot: "bg-signal-warning" },
  dev: { color: "text-signal-info", dot: "bg-signal-info" },
  development: { color: "text-signal-info", dot: "bg-signal-info" },
  test: { color: "text-muted-foreground", dot: "bg-muted-foreground" },
  local: { color: "text-blue-400", dot: "bg-blue-400" },
};

function Card({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: typeof Server;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-issues-border bg-issues-surface p-4",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-mono text-xs text-foreground truncate">{value}</span>
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
  const envCfg = env
    ? envConfig[env] || { color: "text-muted-foreground", dot: "bg-muted-foreground" }
    : null;

  const hasBrowserOrOs = contexts?.browser?.name || contexts?.os?.name;
  const hasRuntime = contexts?.runtime?.name;
  const hasRelease = releases && releases.length > 0;
  const hasAnything = env || hasBrowserOrOs || hasRuntime || hasRelease;

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {/* Environment */}
      {env && envCfg && (
        <Card title={t("environment")} icon={Server}>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full animate-pulse", envCfg.dot)} />
            <span className={cn("font-mono text-sm font-medium", envCfg.color)}>
              {env}
            </span>
          </div>
        </Card>
      )}

      {/* Browser / OS */}
      {hasBrowserOrOs && (
        <Card title={t("device")} icon={Globe}>
          <div className="space-y-2">
            {contexts?.browser?.name && (
              <ContextRow
                label={t("browser")}
                value={
                  contexts.browser.version
                    ? `${contexts.browser.name} ${contexts.browser.version}`
                    : contexts.browser.name
                }
              />
            )}
            {contexts?.os?.name && (
              <ContextRow
                label={t("os")}
                value={
                  contexts.os.version
                    ? `${contexts.os.name} ${contexts.os.version}`
                    : contexts.os.name
                }
              />
            )}
          </div>
        </Card>
      )}

      {/* Runtime */}
      {hasRuntime && (
        <Card title={t("runtime")} icon={Cpu}>
          <ContextRow
            label={contexts!.runtime!.name!}
            value={contexts!.runtime!.version ?? ""}
          />
        </Card>
      )}

      {/* Release */}
      {hasRelease && (
        <Card title={t("release")} icon={Package}>
          <div className="space-y-2">
            {firstSeenIn && firstSeenIn !== "unknown" && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-muted-foreground">{t("firstSeenIn")}</span>
                <span className="font-mono text-xs font-medium text-pulse-primary">
                  {firstSeenIn}
                </span>
              </div>
            )}
            {releases.slice(0, 3).map((release) => (
              <div key={release.version} className="flex items-center justify-between">
                <span className="font-mono text-xs text-foreground">{release.version}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-muted/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pulse-primary rounded-full"
                      style={{ width: `${release.percentage}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">
                    {release.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Fallback if nothing */}
      {!hasAnything && (
        <Card title={t("context")} icon={Server} className="col-span-full">
          <p className="text-sm text-muted-foreground italic">{t("noContext")}</p>
        </Card>
      )}
    </div>
  );
}
