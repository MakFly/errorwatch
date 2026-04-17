"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { useCurrentOrganization } from "@/contexts/OrganizationContext";
import { useReplaySessions, type ReplaySessionsFilters } from "@/lib/trpc/hooks";
import {
  DeviceDistributionBar,
  ReplaysFiltersRow,
  createReplaysColumns,
} from "@/components/replays";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SdkNotInstalledState } from "@/components/dashboard/SdkNotInstalledState";
import { Film } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import type { DeviceType, ErrorLevel } from "@/server/api";

type DateRange = "24h" | "7d" | "30d" | "90d" | "all";

interface FiltersState {
  search: string;
  browser: string;
  os: string;
  dateRange: DateRange;
  severity: string;
}

function getDateFromRange(range: DateRange): string | undefined {
  if (range === "all") return undefined;

  const now = new Date();
  switch (range) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return undefined;
  }
}

export default function ReplaysPage() {
  const t = useTranslations("replays");
  const tHeader = useTranslations("pageHeader.replays");
  const locale = useLocale();
  const { currentProjectId, currentProjectSlug } = useCurrentProject();
  const { currentOrgSlug } = useCurrentOrganization();

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FiltersState>({
    search: "",
    browser: "all",
    os: "all",
    dateRange: "all",
    severity: "all",
  });
  const [deviceFilter, setDeviceFilter] = useState<DeviceType | "all">("all");

  // Convert filter state to API format
  const apiFilters = useMemo((): ReplaySessionsFilters => {
    const result: ReplaySessionsFilters = {};

    if (deviceFilter !== "all") {
      result.deviceType = deviceFilter;
    }
    if (filters.browser !== "all") {
      result.browser = filters.browser;
    }
    if (filters.os !== "all") {
      result.os = filters.os;
    }
    if (filters.severity !== "all") {
      result.severity = filters.severity as ErrorLevel;
    }

    const dateFrom = getDateFromRange(filters.dateRange);
    if (dateFrom) {
      result.dateFrom = dateFrom;
    }

    return result;
  }, [filters, deviceFilter]);

  const { data, isLoading, error } = useReplaySessions(apiFilters, page, currentProjectId || undefined);

  const hasActiveFilters =
    filters.search !== "" ||
    filters.browser !== "all" ||
    filters.os !== "all" ||
    filters.dateRange !== "all" ||
    filters.severity !== "all" ||
    deviceFilter !== "all";

  // Client-side search filtering (URL search)
  const filteredSessions = useMemo(() => {
    if (!data?.sessions) return [];

    if (!filters.search) return data.sessions;

    const search = filters.search.toLowerCase();
    return data.sessions.filter(
      (s) => s.url?.toLowerCase().includes(search)
    );
  }, [data?.sessions, filters.search]);

  const handleClearFilters = () => {
    setFilters({
      search: "",
      browser: "all",
      os: "all",
      dateRange: "all",
      severity: "all",
    });
    setDeviceFilter("all");
    setPage(1);
  };

  const columns = useMemo(
    () => createReplaysColumns({
      orgSlug: currentOrgSlug || "",
      projectSlug: currentProjectSlug || "",
      t: (key: string) => t(key as any),
      locale,
    }),
    [currentOrgSlug, currentProjectSlug, t, locale]
  );

  const totalSessions = data?.pagination?.total || 0;
  const deviceStats = data?.stats || { desktop: 0, mobile: 0, tablet: 0, totalErrors: 0 };

  const sessionBadge = (
    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
      <Film className="h-4 w-4 text-primary" />
      {isLoading ? (
        <Skeleton className="h-4 w-8" />
      ) : (
        <span className="font-mono text-sm font-semibold text-primary">
          {totalSessions.toLocaleString()}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{t("sessions")}</span>
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <PageHeader title={tHeader("title")} description={tHeader("description")}>
          {sessionBadge}
        </PageHeader>
        <div className="text-center py-12">
          <p className="text-destructive">{t("failedToLoad")}</p>
          <p className="text-muted-foreground text-sm mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  const hasNoSessions = !isLoading && totalSessions === 0 && !hasActiveFilters;

  if (hasNoSessions) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <PageHeader title={tHeader("title")} description={tHeader("description")} />
        <SdkNotInstalledState
          title={t("sdkNotInstalled.title")}
          message={t("sdkNotInstalled.message")}
          icon={Film}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PageHeader title={tHeader("title")} description={tHeader("description")}>
        {sessionBadge}
      </PageHeader>

      <DeviceDistributionBar
        stats={deviceStats}
        activeFilter={deviceFilter}
        onFilterChange={(device) => {
          setDeviceFilter(device);
          setPage(1);
        }}
        isLoading={isLoading}
      />

      <ReplaysFiltersRow
        search={filters.search}
        onSearchChange={(value) => setFilters({ ...filters, search: value })}
        browser={filters.browser}
        onBrowserChange={(value) => {
          setFilters({ ...filters, browser: value });
          setPage(1);
        }}
        os={filters.os}
        onOsChange={(value) => {
          setFilters({ ...filters, os: value });
          setPage(1);
        }}
        dateRange={filters.dateRange}
        onDateRangeChange={(value) => {
          setFilters({ ...filters, dateRange: value });
          setPage(1);
        }}
        severity={filters.severity}
        onSeverityChange={(value) => {
          setFilters({ ...filters, severity: value });
          setPage(1);
        }}
        onClear={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <DataTable
        data={filteredSessions}
        columns={columns}
        isLoading={isLoading}
        showSearch={false}
        showColumnToggle
        enableRowSelection={false}
        pageSize={8}
        className="w-full"
        getRowId={(session) => session.id}
        emptyMessage={
          hasActiveFilters
            ? t("noMatchingSessions")
            : t("noSessionsYet")
        }
      />
    </div>
  );
}
