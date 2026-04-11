"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MetricRibbonItem {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  alert?: boolean;
}

interface MetricRibbonProps {
  metrics: MetricRibbonItem[];
  isLoading?: boolean;
}

export function MetricRibbon({ metrics, isLoading }: MetricRibbonProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-16" />
              <Skeleton className="mt-1 h-3 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map(({ label, value, sub, alert }) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "font-mono text-xl font-bold",
                alert ? "text-red-500" : "text-foreground"
              )}
            >
              {value}
            </p>
            {sub && (
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  alert ? "text-red-400" : "text-muted-foreground"
                )}
              >
                {sub}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
