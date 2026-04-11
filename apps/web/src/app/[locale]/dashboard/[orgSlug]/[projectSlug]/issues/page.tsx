"use client";

import { useState, useMemo, useCallback } from "react";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { useCurrentOrganization } from "@/contexts/OrganizationContext";
import { useGroups, useMergeGroups } from "@/lib/trpc/hooks";
import {
  IssuesHeader,
  FiltersRow,
  ErrorState,
} from "@/components/issues";
import { DataTable } from "@/components/ui/data-table";
import { createIssuesColumns } from "@/components/issues/issues-data-table-columns";
import type { IssueGroup } from "@/components/issues/issues-data-table-columns";
import type { RowSelectionState } from "@tanstack/react-table";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { normalizeGroups } from "@/lib/utils/normalize-groups";
import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type DateRange = "24h" | "7d" | "30d" | "90d" | "all";

interface FiltersState {
  env: string;
  dateRange: DateRange;
  search: string;
  level: string;
}

export default function IssuesPage() {
  const { currentProjectId, currentProjectSlug } = useCurrentProject();
  const { currentOrgSlug } = useCurrentOrganization();
  const t = useTranslations("issues.page");

  const [filters, setFilters] = useState<FiltersState>({
    env: "all",
    dateRange: "all",
    search: "",
    level: "actionable",
  });
  const [page, setPage] = useState(1);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const debouncedSearch = useDebounce(filters.search, 300);

  const mergeGroups = useMergeGroups();

  // Compute level filter params
  const levelFilter = useMemo(() => {
    if (filters.level === "actionable") return { levels: ["fatal", "error", "warning"] };
    if (filters.level === "all") return {};
    return { level: filters.level as "fatal" | "error" | "warning" | "info" | "debug" };
  }, [filters.level]);

  const { data: groupsData, isLoading, error, refetch } = useGroups({
    env: filters.env === "all" ? undefined : filters.env,
    dateRange: filters.dateRange === "all" ? undefined : filters.dateRange,
    projectId: currentProjectId || undefined,
    search: debouncedSearch || undefined,
    page,
    limit: 25,
    ...levelFilter,
  });

  const groups = useMemo(() => normalizeGroups<IssueGroup>(groupsData), [groupsData]);

  const totalSignals = useMemo(() => {
    if (!groupsData) return 0;
    if (Array.isArray(groupsData)) return groupsData.length;
    return groupsData.total || 0;
  }, [groupsData]);

  const totalPages = useMemo(() => {
    if (!groupsData) return 1;
    if (Array.isArray(groupsData)) return 1;
    return groupsData.totalPages || 1;
  }, [groupsData]);

  const hasActiveFilters =
    filters.env !== "all" ||
    filters.dateRange !== "all" ||
    filters.search !== "" ||
    filters.level !== "actionable";

  const handleClearFilters = () => {
    setFilters({
      env: "all",
      dateRange: "all",
      search: "",
      level: "actionable",
    });
    setPage(1);
  };

  const selectedFingerprints = useMemo(() => {
    return Object.keys(rowSelection).filter((key) => rowSelection[key]);
  }, [rowSelection]);

  const handleMerge = useCallback(async () => {
    if (selectedFingerprints.length < 2) return;
    try {
      const [parent, ...children] = selectedFingerprints;
      await mergeGroups.mutateAsync({ parentFingerprint: parent, childFingerprints: children });
      toast.success(t("mergeSuccess", { count: children.length }));
      setRowSelection({});
      refetch();
    } catch {
      toast.error(t("mergeError"));
    }
  }, [selectedFingerprints, mergeGroups, refetch, t]);

  const columns = useMemo(
    () => createIssuesColumns({ orgSlug: currentOrgSlug || "", projectSlug: currentProjectSlug || "" }),
    [currentOrgSlug, currentProjectSlug]
  );

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-4 bg-issues-bg p-4 md:gap-6 md:p-6">
        <IssuesHeader totalSignals={0} />
        <ErrorState message={error.message} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 bg-issues-bg p-4 md:gap-6 md:p-6">
      <IssuesHeader totalSignals={totalSignals} isLoading={isLoading} />

      <div className="flex items-end justify-between gap-4">
        <FiltersRow
          search={filters.search}
          onSearchChange={(value) => { setFilters({ ...filters, search: value }); setPage(1); }}
          environment={filters.env}
          onEnvironmentChange={(value) => { setFilters({ ...filters, env: value }); setPage(1); }}
          dateRange={filters.dateRange}
          onDateRangeChange={(value) => { setFilters({ ...filters, dateRange: value }); setPage(1); }}
          level={filters.level}
          onLevelChange={(value) => { setFilters({ ...filters, level: value }); setPage(1); }}
          onClear={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          className="flex-1"
        />
        <ExportDropdown projectId={currentProjectId} dateRange={filters.dateRange} />
      </div>

      {/* Bulk action toolbar */}
      {selectedFingerprints.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2 text-sm">
          <span className="font-medium">{t("selected", { count: selectedFingerprints.length })}</span>
          {selectedFingerprints.length >= 2 && (
            <>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={handleMerge}
                className="text-purple-600 hover:underline"
                disabled={mergeGroups.isPending}
              >
                {t("bulkMerge")}
              </button>
            </>
          )}
        </div>
      )}

      <DataTable
        data={groups}
        columns={columns}
        isLoading={isLoading}
        showSearch={false}
        showColumnToggle
        enableRowSelection
        pageSize={25}
        className="w-full"
        getRowId={(group: any) => group.fingerprint}
        onRowSelectionChange={setRowSelection}
        rowSelection={rowSelection}
        emptyMessage={
          hasActiveFilters
            ? t("noMatchingSignals")
            : t("noSignals")
        }
      />

      {/* Server-side pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} ({totalSignals} total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { getMonitoringApiUrl } from "@/lib/config";

function ExportDropdown({
  projectId,
  dateRange,
}: {
  projectId: string | null;
  dateRange: string;
}) {
  const t = useTranslations("issues.page");

  const handleExport = (format: "csv" | "json") => {
    const apiUrl = getMonitoringApiUrl();
    if (!projectId) return;
    const params = new URLSearchParams({ projectId, format });
    if (dateRange !== "all") params.set("dateRange", dateRange);
    window.open(`${apiUrl}/api/v1/export/errors?${params.toString()}`, "_blank");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="size-4" />
          {t("exportButton")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          {t("exportCSV")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          {t("exportJSON")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
