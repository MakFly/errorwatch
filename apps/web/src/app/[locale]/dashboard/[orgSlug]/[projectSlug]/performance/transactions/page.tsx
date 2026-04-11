"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc/client";
import { TransactionsDataTable, SlowestTable } from "@/components/performance/TransactionsDataTable";
import { ThroughputChart } from "@/components/performance/ThroughputChart";
import { DurationChart } from "@/components/performance/DurationChart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PerformanceDateRange } from "@/server/api/types";

export default function TransactionsPage() {
  const t = useTranslations("performance");
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const projectSlug = params.projectSlug as string;
  const baseUrl = `/dashboard/${orgSlug}/${projectSlug}`;

  const { currentProjectId, isLoading: projectLoading } = useCurrentProject();
  const [dateRange, setDateRange] = useState<PerformanceDateRange>("24h");

  const { data: transactionsData, isLoading: transactionsLoading } =
    trpc.performance.getTransactions.useQuery(
      { projectId: currentProjectId!, dateRange },
      { enabled: !!currentProjectId }
    );

  const { data: slowest, isLoading: slowestLoading } =
    trpc.performance.getSlowest.useQuery(
      { projectId: currentProjectId!, dateRange },
      { enabled: !!currentProjectId }
    );

  const { data: throughputData, isLoading: throughputLoading } =
    trpc.performance.getThroughputTimeline.useQuery(
      { projectId: currentProjectId!, dateRange },
      { enabled: !!currentProjectId }
    );

  const { data: durationData, isLoading: durationLoading } =
    trpc.performance.getDurationTimeline.useQuery(
      { projectId: currentProjectId!, dateRange },
      { enabled: !!currentProjectId }
    );

  if (projectLoading) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("transactions.title")}</h1>
        <Select
          value={dateRange}
          onValueChange={(v) => setDateRange(v as PerformanceDateRange)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">{t("dateRange.last24h")}</SelectItem>
            <SelectItem value="7d">{t("dateRange.last7d")}</SelectItem>
            <SelectItem value="30d">{t("dateRange.last30d")}</SelectItem>
            <SelectItem value="90d">{t("dateRange.last90d")}</SelectItem>
            <SelectItem value="6m">{t("dateRange.last6m")}</SelectItem>
            <SelectItem value="1y">{t("dateRange.lastYear")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ThroughputChart
          data={throughputData ?? []}
          isLoading={throughputLoading}
          dateRange={dateRange}
        />
        <DurationChart
          data={durationData ?? []}
          isLoading={durationLoading}
          dateRange={dateRange}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">{t("transactions.tabAll")}</TabsTrigger>
          <TabsTrigger value="slowest">{t("transactions.tabSlowest")}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <TransactionsDataTable
            transactions={transactionsData?.transactions || []}
            pagination={transactionsData?.pagination}
            baseUrl={baseUrl}
            isLoading={transactionsLoading}
          />
        </TabsContent>

        <TabsContent value="slowest" className="mt-4">
          <SlowestTable
            transactions={slowest || []}
            isLoading={slowestLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
