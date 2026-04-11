"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc/client";
import { WebVitalsCards } from "@/components/performance";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PerformanceDateRange, Platform } from "@/server/api/types";

const SERVER_SIDE_PLATFORMS: Platform[] = [
  "symfony",
  "laravel",
  "nodejs",
  "hono",
  "fastify",
];

export default function WebVitalsPage() {
  const t = useTranslations("performance");
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const projectSlug = params.projectSlug as string;
  const baseUrl = `/dashboard/${orgSlug}/${projectSlug}`;

  const { currentProjectId, currentProject, isLoading: projectLoading } = useCurrentProject();
  const [dateRange, setDateRange] = useState<PerformanceDateRange>("24h");

  const isServerSide =
    !!currentProject?.platform &&
    SERVER_SIDE_PLATFORMS.includes(currentProject.platform);

  const { data: webVitals, isLoading: vitalsLoading } =
    trpc.performance.getWebVitals.useQuery(
      { projectId: currentProjectId!, dateRange },
      { enabled: !!currentProjectId && !isServerSide }
    );

  if (projectLoading || (!isServerSide && vitalsLoading)) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("webVitals.title")}</h1>
        {!isServerSide && (
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
        )}
      </div>

      {isServerSide ? (
        <Card className="border-muted bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">{t("webVitals.serverSideTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("webVitals.serverSideMessage", {
                platform: currentProject!.platform,
              })}
            </p>
            <p className="text-sm font-medium">{t("webVitals.serverSideHint")}</p>
            <ul className="space-y-1 text-sm">
              <li>
                <Link
                  href={`${baseUrl}/performance/transactions`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t("subPages.transactions.title")}
                </Link>
              </li>
              <li>
                <Link
                  href={`${baseUrl}/performance/queries`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t("subPages.databaseQueries.title")}
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>
      ) : (
        <WebVitalsCards vitals={webVitals || []} />
      )}
    </div>
  );
}
