"use client";

import { useState, useMemo, useCallback } from "react";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { useCurrentOrganization } from "@/contexts/OrganizationContext";
import { useGroups, useBatchUpdateStatus, useMergeGroups, useSnoozeGroup } from "@/lib/trpc/hooks";
import {
  IssuesHeader,
  SeverityDistributionBar,
  FiltersRow,
  ErrorState,
} from "@/components/issues";
import { DataTable } from "@/components/ui/data-table";
import { createIssuesColumns } from "@/components/issues/issues-data-table-columns";
import type { ErrorLevel } from "@/server/api";
import type { RowSelectionState } from "@tanstack/react-table";
import { toast } from "sonner";
import { detectEventSource } from "@/lib/event-source";
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

type DateRange = "24h" | "7d" | "30d" | "90d" | "all";

interface FiltersState {
  env: string;
  dateRange: DateRange;
  search: string;
  status: string;
  source: string;
}

export default function IssuesPage() {
  const { currentProjectId, currentProjectSlug } = useCurrentProject();
  const { currentOrgSlug } = useCurrentOrganization();

  const [filters, setFilters] = useState<FiltersState>({
    env: "all",
    dateRange: "all",
    search: "",
    status: "all",
    source: "all",
  });
  const [levelFilter, setLevelFilter] = useState<ErrorLevel | "all">("all");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const debouncedSearch = useDebounce(filters.search, 300);

  const batchUpdate = useBatchUpdateStatus();
  const mergeGroups = useMergeGroups();
  const snoozeGroup = useSnoozeGroup();

  // Pass filters to server
  const { data: groupsData, isLoading, error, refetch } = useGroups({
    env: filters.env === "all" ? undefined : filters.env,
    dateRange: filters.dateRange === "all" ? undefined : filters.dateRange,
    projectId: currentProjectId || undefined,
    search: debouncedSearch || undefined,
    status: filters.status === "all" ? undefined : filters.status as any,
    level: levelFilter === "all" ? undefined : levelFilter,
  });

  const allGroups = useMemo(() => normalizeGroups(groupsData), [groupsData]);

  // Client-side source filter
  const groups = useMemo(() => {
    if (filters.source === "all") return allGroups;
    return allGroups.filter((g: any) => {
      const source = detectEventSource(g.url);
      return source.type === filters.source;
    });
  }, [allGroups, filters.source]);

  const totalSignals = useMemo(() => {
    if (!groupsData) return 0;
    if (Array.isArray(groupsData)) return groupsData.length;
    return (groupsData as any).total || 0;
  }, [groupsData]);

  const hasActiveFilters =
    filters.env !== "all" ||
    filters.dateRange !== "all" ||
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.source !== "all" ||
    levelFilter !== "all";

  const severityStats = useMemo(() => {
    if (!groups) return { fatal: 0, error: 0, warning: 0, info: 0, debug: 0 };

    return {
      fatal: groups.filter((g: any) => g.level === "fatal").length,
      error: groups.filter((g: any) => g.level === "error").length,
      warning: groups.filter((g: any) => g.level === "warning").length,
      info: groups.filter((g: any) => g.level === "info").length,
      debug: groups.filter((g: any) => g.level === "debug").length,
    };
  }, [groups]);

  const handleClearFilters = () => {
    setFilters({
      env: "all",
      dateRange: "all",
      search: "",
      status: "all",
      source: "all",
    });
    setLevelFilter("all");
  };

  const maxCount = useMemo(() => {
    if (!groups.length) return 0;
    return Math.max(...groups.map((g: any) => g.count));
  }, [groups]);

  const selectedFingerprints = useMemo(() => {
    return Object.keys(rowSelection).filter((key) => rowSelection[key]);
  }, [rowSelection]);

  const handleBulkAction = useCallback(
    async (status: "open" | "resolved" | "ignored") => {
      if (selectedFingerprints.length === 0) return;
      try {
        await batchUpdate.mutateAsync({ fingerprints: selectedFingerprints, status });
        toast.success(`${selectedFingerprints.length} issue(s) updated to ${status}`);
        setRowSelection({});
        refetch();
      } catch {
        toast.error("Failed to update issues");
      }
    },
    [selectedFingerprints, batchUpdate, refetch]
  );

  const handleMerge = useCallback(async () => {
    if (selectedFingerprints.length < 2) return;
    try {
      const [parent, ...children] = selectedFingerprints;
      await mergeGroups.mutateAsync({ parentFingerprint: parent, childFingerprints: children });
      toast.success(`Merged ${children.length} issue(s) into 1`);
      setRowSelection({});
      refetch();
    } catch {
      toast.error("Failed to merge issues");
    }
  }, [selectedFingerprints, mergeGroups, refetch]);

  const columns = useMemo(
    () => createIssuesColumns({ orgSlug: currentOrgSlug || "", projectSlug: currentProjectSlug || "", maxCount, onStatusChange: refetch }),
    [currentOrgSlug, currentProjectSlug, maxCount, refetch]
  );

  if (error) {
    return (
      <div className="min-h-screen bg-issues-bg p-4 md:p-6">
        <IssuesHeader totalSignals={0} />
        <ErrorState message={error.message} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-issues-bg p-4 md:p-6">
      <IssuesHeader totalSignals={totalSignals} isLoading={isLoading} />

      <SeverityDistributionBar
        stats={severityStats}
        activeFilter={levelFilter}
        onFilterChange={setLevelFilter}
        isLoading={isLoading}
        className="mb-6"
      />

      <div className="mb-6 flex items-end justify-between gap-4">
        <FiltersRow
          search={filters.search}
          onSearchChange={(value) => setFilters({ ...filters, search: value })}
          environment={filters.env}
          onEnvironmentChange={(value) => setFilters({ ...filters, env: value })}
          dateRange={filters.dateRange}
          onDateRangeChange={(value) =>
            setFilters({ ...filters, dateRange: value })
          }
          status={filters.status}
          onStatusChange={(value) => setFilters({ ...filters, status: value })}
          source={filters.source}
          onSourceChange={(value) => setFilters({ ...filters, source: value })}
          onClear={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          className="flex-1"
        />
        <ExportDropdown projectId={currentProjectId} dateRange={filters.dateRange} status={filters.status} />
      </div>

      {/* Bulk action toolbar */}
      {selectedFingerprints.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2 text-sm">
          <span className="font-medium">{selectedFingerprints.length} selected</span>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={() => handleBulkAction("resolved")}
            className="text-green-600 hover:underline"
            disabled={batchUpdate.isPending}
          >
            Resolve
          </button>
          <button
            onClick={() => handleBulkAction("ignored")}
            className="text-yellow-600 hover:underline"
            disabled={batchUpdate.isPending}
          >
            Ignore
          </button>
          <button
            onClick={() => handleBulkAction("open")}
            className="text-blue-600 hover:underline"
            disabled={batchUpdate.isPending}
          >
            Reopen
          </button>
          {selectedFingerprints.length >= 2 && (
            <button
              onClick={handleMerge}
              className="text-purple-600 hover:underline"
              disabled={mergeGroups.isPending}
            >
              Merge
            </button>
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
        pageSize={15}
        className="w-full"
        getRowId={(group: any) => group.fingerprint}
        onRowSelectionChange={setRowSelection}
        rowSelection={rowSelection}
        emptyMessage={
          hasActiveFilters
            ? "No matching signals found. Try adjusting your filters."
            : "No signals detected. Your application is running smoothly."
        }
      />
    </div>
  );
}

import { MONITORING_API_URL } from "@/lib/config";
const API_URL = MONITORING_API_URL;

function ExportDropdown({
  projectId,
  dateRange,
  status,
}: {
  projectId: string | null;
  dateRange: string;
  status: string;
}) {
  const handleExport = (format: "csv" | "json") => {
    if (!projectId) return;
    const params = new URLSearchParams({ projectId, format });
    if (dateRange !== "all") params.set("dateRange", dateRange);
    if (status !== "all") params.set("status", status);
    window.open(`${API_URL}/api/v1/export/errors?${params.toString()}`, "_blank");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="size-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          Export JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
