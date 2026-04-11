"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Radio } from "lucide-react";
import { useTranslations } from "next-intl";

type DateRange = "24h" | "7d" | "30d" | "90d" | "all";

interface FiltersRowProps {
  search: string;
  onSearchChange: (value: string) => void;
  environment: string;
  onEnvironmentChange: (value: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (value: DateRange) => void;
  level?: string;
  onLevelChange?: (value: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  className?: string;
}

export function FiltersRow({
  search,
  onSearchChange,
  environment,
  onEnvironmentChange,
  dateRange,
  onDateRangeChange,
  level,
  onLevelChange,
  onClear,
  hasActiveFilters,
  className,
}: FiltersRowProps) {
  const t = useTranslations("issues.filters");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center",
        className
      )}
    >
      {/* Search */}
      <div className="relative flex-1 sm:max-w-sm">
        <Radio className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pulse-muted" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "w-full rounded-lg border border-issues-border bg-issues-surface/50 py-2 pl-10 pr-4 text-sm",
            "placeholder:text-muted-foreground/50",
            "focus:border-pulse-primary/50 focus:outline-none focus:ring-2 focus:ring-pulse-primary/20",
            "transition-all"
          )}
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Environment */}
      <Select value={environment} onValueChange={onEnvironmentChange}>
        <SelectTrigger className="w-full border-issues-border bg-issues-surface/50 sm:w-[140px]">
          <SelectValue placeholder={t("allEnvs")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("allEnvs")}</SelectItem>
          <SelectItem value="prod">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-signal-fatal" />
              {t("production")}
            </span>
          </SelectItem>
          <SelectItem value="staging">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-signal-warning" />
              {t("staging")}
            </span>
          </SelectItem>
          <SelectItem value="dev">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-signal-info" />
              {t("development")}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Date Range */}
      <Select value={dateRange} onValueChange={(v) => onDateRangeChange(v as DateRange)}>
        <SelectTrigger className="w-full border-issues-border bg-issues-surface/50 sm:w-[130px]">
          <SelectValue placeholder={t("allTime")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("allTime")}</SelectItem>
          <SelectItem value="24h">{t("last24h")}</SelectItem>
          <SelectItem value="7d">{t("last7d")}</SelectItem>
          <SelectItem value="30d">{t("last30d")}</SelectItem>
          <SelectItem value="90d">{t("last90d")}</SelectItem>
        </SelectContent>
      </Select>

      {/* Level */}
      {onLevelChange && (
        <Select value={level || "actionable"} onValueChange={onLevelChange}>
          <SelectTrigger className="w-full border-issues-border bg-issues-surface/50 sm:w-[140px]">
            <SelectValue placeholder={t("levelActionable")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="actionable">{t("levelActionable")}</SelectItem>
            <SelectItem value="all">{t("levelAll")}</SelectItem>
            <SelectItem value="fatal">{t("levelFatal")}</SelectItem>
            <SelectItem value="error">{t("levelError")}</SelectItem>
            <SelectItem value="warning">{t("levelWarning")}</SelectItem>
            <SelectItem value="info">{t("levelInfo")}</SelectItem>
            <SelectItem value="debug">{t("levelDebug")}</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-lg border border-issues-border bg-issues-surface/30 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-issues-surface hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          {t("clear")}
        </button>
      )}
    </div>
  );
}
