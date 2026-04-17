"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc/client";
import { QueryInsights } from "@/components/performance";
import { PageHeader } from "@/components/dashboard/PageHeader";
import type { PerformanceDateRange } from "@/server/api/types";

export default function DatabasePage() {
  const tHeader = useTranslations("pageHeader.performanceDatabase");
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const projectSlug = params.projectSlug as string;
  const baseUrl = `/dashboard/${orgSlug}/${projectSlug}`;

  const { currentProjectId, isLoading: projectLoading } = useCurrentProject();
  const [dateRange, setDateRange] = useState<PerformanceDateRange>("24h");

  const { data: spanAnalysis, isLoading: spanAnalysisLoading } =
    trpc.performance.getSpanAnalysis.useQuery(
      { projectId: currentProjectId!, dateRange },
      { enabled: !!currentProjectId }
    );

  if (projectLoading) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PageHeader
        title={tHeader("title")}
        description={tHeader("description")}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      <QueryInsights
        n1Queries={spanAnalysis?.n1Queries ?? []}
        frequentQueries={spanAnalysis?.frequentQueries ?? []}
        slowQueries={spanAnalysis?.slowQueries ?? []}
        isLoading={spanAnalysisLoading}
        baseUrl={baseUrl}
      />
    </div>
  );
}
