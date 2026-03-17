"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Server, Terminal, FileCode, Copy, Check, CheckCircle2, Info } from "lucide-react";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { useInfrastructureQueries } from "@/hooks/useInfrastructureQueries";
import {
  CpuChart,
  MemoryChart,
  NetworkChart,
  DiskUsage,
  HostSelector,
  DateRangeSelector,
} from "@/components/infrastructure";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InfraDateRange } from "@/server/api/types";

function GuideCodeBlock({ code, title, icon: Icon }: { code: string; title: string; icon: React.ComponentType<{ className?: string }> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
            copied ? "text-green-500" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto">
        <code className="text-sm font-mono text-foreground/90">{code.trim()}</code>
      </pre>
    </div>
  );
}

function GuideStep({ number, title, description, children }: { number: number; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex shrink-0 items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
          {number}
        </span>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="ml-10">{children}</div>
    </div>
  );
}

function SetupGuide() {
  const t = useTranslations("infrastructure.guide");

  const installCode = `git clone https://github.com/MakFly/errorwatch-sdk-metrics.git
cd errorwatch-sdk-metrics
go build -o sdk-metrics .`;

  const initCode = `./sdk-metrics --init`;

  const configCode = `# sdk-metrics.yaml
endpoint: "https://api.errorwatch.io"
api_key: "YOUR_API_KEY"
host_id: "my-server"
hostname: "my-server"
collection_interval: 10
tags:
  env: production
  role: api`;

  const startCode = `./sdk-metrics --config sdk-metrics.yaml`;

  const envCode = `export METRICS_API_KEY="your_api_key_here"
export METRICS_ENDPOINT="https://api.errorwatch.io"
export METRICS_HOST_ID="my-server"
./sdk-metrics`;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-3 pb-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
          <Server className="h-8 w-8 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Requirements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-muted-foreground" />
            {t("requirements")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            {t("requirementGo")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            {t("requirementOs")}
          </span>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-6">
        <GuideStep number={1} title={t("step1Title")} description={t("step1Desc")}>
          <GuideCodeBlock code={installCode} title="Terminal" icon={Terminal} />
        </GuideStep>

        <GuideStep number={2} title={t("step2Title")} description={t("step2Desc")}>
          <GuideCodeBlock code={initCode} title="Terminal" icon={Terminal} />
        </GuideStep>

        <GuideStep number={3} title={t("step3Title")} description={t("step3Desc")}>
          <GuideCodeBlock code={configCode} title="sdk-metrics.yaml" icon={FileCode} />
          <p className="mt-2 text-xs text-amber-500">{t("step3Note")}</p>
        </GuideStep>

        <GuideStep number={4} title={t("step4Title")} description={t("step4Desc")}>
          <GuideCodeBlock code={startCode} title="Terminal" icon={Terminal} />
          <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
            <p className="text-xs text-emerald-400">{t("step4Note")}</p>
          </div>
        </GuideStep>
      </div>

      {/* Alternative: env vars */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("alternativeTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("alternativeDesc")}</p>
        </CardHeader>
        <CardContent>
          <GuideCodeBlock code={envCode} title="Terminal" icon={Terminal} />
        </CardContent>
      </Card>
    </div>
  );
}

function InfrastructureSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-1 h-4 w-72" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[250px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function InfrastructurePage() {
  const t = useTranslations("infrastructure");
  const { currentProjectId, isLoading: projectLoading } = useCurrentProject();

  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<InfraDateRange>("1h");

  const { hosts, latest, history } = useInfrastructureQueries(currentProjectId, {
    hostId: selectedHostId,
    dateRange,
  });

  const hostList = useMemo(() => hosts.data ?? [], [hosts.data]);

  // Derive effective host: user selection or first available
  const effectiveHostId = selectedHostId ?? hostList[0]?.hostId ?? null;

  const historyData = history.data ?? [];
  const latestData = latest.data ?? [];
  const selectedSnapshot = latestData.find((s) => s.hostId === effectiveHostId);

  // Loading: wait for project context and initial hosts query
  if (projectLoading || !currentProjectId || hosts.isLoading) {
    return <InfrastructureSkeleton />;
  }

  // Empty state: show setup guide
  if (hostList.length === 0) {
    return <SetupGuide />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <HostSelector
          hosts={hostList}
          value={effectiveHostId}
          onChange={setSelectedHostId}
        />
        <DateRangeSelector
          value={dateRange}
          onChange={(v) => setDateRange(v as InfraDateRange)}
        />
      </div>

      {/* Charts Row 1: CPU | Memory */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CpuChart data={historyData} />
        <MemoryChart data={historyData} />
      </div>

      {/* Charts Row 2: Network | Disk */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NetworkChart data={historyData} />
        <DiskUsage disks={selectedSnapshot?.disks ?? null} />
      </div>
    </div>
  );
}
