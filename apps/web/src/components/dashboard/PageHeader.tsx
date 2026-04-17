"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PerformanceDateRange } from "@/server/api";

const DEFAULT_RANGE_OPTIONS: PerformanceDateRange[] = ["24h", "7d", "30d", "90d"];

const RANGE_LABEL_KEY: Record<PerformanceDateRange, string> = {
  "24h": "last24h",
  "7d": "last7d",
  "30d": "last30d",
  "90d": "last90d",
  "6m": "last6m",
  "1y": "last1y",
};

export interface PageHeaderProps {
  title: string;
  description?: string;
  dateRange?: PerformanceDateRange;
  onDateRangeChange?: (range: PerformanceDateRange) => void;
  rangeOptions?: PerformanceDateRange[];
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  dateRange,
  onDateRangeChange,
  rangeOptions = DEFAULT_RANGE_OPTIONS,
  children,
}: PageHeaderProps) {
  const tRange = useTranslations("pageHeader.range");
  const showRange = dateRange !== undefined && onDateRangeChange !== undefined;

  return (
    <div className="flex flex-col gap-3 border-b border-dashboard-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-mono text-2xl font-bold text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {showRange ? (
          <Select
            value={dateRange}
            onValueChange={(v) => onDateRangeChange(v as PerformanceDateRange)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rangeOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {tRange(RANGE_LABEL_KEY[r] as "last24h" | "last7d" | "last30d" | "last90d")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
  );
}
