"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EndpointImpact as EndpointImpactType } from "@/server/api/types/performance";

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

interface EndpointImpactProps {
  data: EndpointImpactType[] | undefined;
  isLoading: boolean;
  baseUrl: string;
}

export function EndpointImpact({ data, isLoading, baseUrl }: EndpointImpactProps) {
  const t = useTranslations("performance.queries.endpointImpact");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">{t("columns.endpoint")}</th>
                <th className="pb-2 font-medium text-right">{t("columns.count")}</th>
                <th className="pb-2 font-medium text-right">{t("columns.avg")}</th>
                <th className="pb-2 font-medium text-right">{t("columns.totalTime")}</th>
                <th className="pb-2 font-medium text-right">{t("columns.impact")}</th>
                <th className="pb-2 font-medium text-right">{t("columns.errors")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((endpoint, idx) => (
                <tr key={`${endpoint.name}-${endpoint.op}`} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-mono text-muted-foreground">
                        {idx + 1}
                      </span>
                      {baseUrl ? (
                        <Link
                          href={`${baseUrl}/performance/requests/${encodeURIComponent(endpoint.name)}`}
                          className="font-mono text-xs truncate max-w-[300px] hover:text-violet-400 hover:underline"
                          title={endpoint.name}
                        >
                          {endpoint.name}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs truncate max-w-[300px]" title={endpoint.name}>
                          {endpoint.name}
                        </span>
                      )}
                      <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-mono text-violet-400">
                        {endpoint.op}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs">
                    {endpoint.count}
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs">
                    {formatMs(endpoint.avgDuration)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs">
                    {formatMs(endpoint.totalDuration)}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500/60"
                          style={{ width: `${Math.min(endpoint.percentOfTotal, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground w-10 text-right">
                        {endpoint.percentOfTotal}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    {endpoint.errorCount > 0 ? (
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-mono text-red-400">
                        {endpoint.errorCount}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
