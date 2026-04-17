"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Server } from "lucide-react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SdkNotInstalledState } from "@/components/dashboard/SdkNotInstalledState";
import type { InfraDateRange } from "@/server/api/types";

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
  const tHeader = useTranslations("pageHeader.infrastructure");
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

  // Empty state: SDK (Go metrics agent) not installed yet
  if (hostList.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <PageHeader title={tHeader("title")} description={tHeader("description")} />
        <SdkNotInstalledState
          title={t("sdkNotInstalled.title")}
          message={t("sdkNotInstalled.message")}
          icon={Server}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PageHeader title={tHeader("title")} description={tHeader("description")}>
        <HostSelector
          hosts={hostList}
          value={effectiveHostId}
          onChange={setSelectedHostId}
        />
        <DateRangeSelector
          value={dateRange}
          onChange={(v) => setDateRange(v as InfraDateRange)}
        />
      </PageHeader>

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
