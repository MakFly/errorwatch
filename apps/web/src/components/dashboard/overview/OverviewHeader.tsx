"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import type { PerformanceDateRange } from "@/server/api";

interface OverviewHeaderProps {
  dateRange: PerformanceDateRange;
  onDateRangeChange: (range: PerformanceDateRange) => void;
}

export function OverviewHeader({
  dateRange,
  onDateRangeChange,
}: OverviewHeaderProps) {
  const t = useTranslations("pageHeader.dashboard");
  return (
    <PageHeader
      title={t("title")}
      description={t("description")}
      dateRange={dateRange}
      onDateRangeChange={onDateRangeChange}
    />
  );
}
