"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow, formatDuration, intervalToDuration } from "date-fns";
import { fr as frLocale, enUS as enLocale } from "date-fns/locale";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Monitor,
  Smartphone,
  Tablet,
  PlayCircleIcon,
  Globe,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { ErrorLevel } from "@/server/api";

type Translator = (key: string) => string;
type DeviceKey = "desktop" | "mobile" | "tablet" | "unknown";

export interface ReplaySessionRow {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  duration: number | null;
  url: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  errorCount: number;
  maxSeverity: ErrorLevel | null;
  errorFingerprints: string[];
}

interface ReplaysDataTableColumnsProps {
  orgSlug: string;
  projectSlug: string;
  t: Translator;
  locale: string;
}

function formatSessionDuration(durationMs: number | null): string {
  if (!durationMs) return "-";

  const duration = intervalToDuration({ start: 0, end: durationMs });
  const parts: string[] = [];

  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);
  if (duration.seconds || parts.length === 0) parts.push(`${duration.seconds || 0}s`);

  return parts.join(" ");
}

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case "mobile":
      return Smartphone;
    case "tablet":
      return Tablet;
    default:
      return Monitor;
  }
}

function getSeverityColor(level: ErrorLevel | null): string {
  if (!level) return "secondary";
  switch (level.toLowerCase()) {
    case "fatal":
      return "signal-fatal";
    case "error":
      return "signal-error";
    case "warning":
      return "signal-warning";
    case "info":
      return "signal-info";
    case "debug":
      return "signal-debug";
    default:
      return "secondary";
  }
}

function deviceKey(deviceType: string | null): DeviceKey {
  if (deviceType === "desktop" || deviceType === "mobile" || deviceType === "tablet") return deviceType;
  return "unknown";
}

export function createReplaysColumns({
  orgSlug,
  projectSlug,
  t,
  locale,
}: ReplaysDataTableColumnsProps): ColumnDef<ReplaySessionRow, any>[] {
  const dateFnsLocale = locale.startsWith("fr") ? frLocale : enLocale;
  return [
    {
      id: "play",
      header: () => <div className="w-8" />,
      cell: ({ row }) => {
        return (
          <Link
            href={`/dashboard/${orgSlug}/${projectSlug}/replays/${row.original.id}`}
            className="flex items-center justify-center"
          >
            <PlayCircleIcon className="h-5 w-5 text-primary hover:text-primary/80 transition-colors" />
          </Link>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "startedAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-0 text-left"
        >
          {t("columns.session")}
          {column.getIsSorted() === "asc" && (
            <ChevronUpIcon className="ml-2 size-4" />
          )}
          {column.getIsSorted() === "desc" && (
            <ChevronDownIcon className="ml-2 size-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => {
        const startedAt = row.original.startedAt;
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {new Date(startedAt).toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(startedAt), { addSuffix: true, locale: dateFnsLocale })}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "duration",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-0"
        >
          {t("columns.duration")}
          {column.getIsSorted() === "asc" && (
            <ChevronUpIcon className="ml-2 size-4" />
          )}
          {column.getIsSorted() === "desc" && (
            <ChevronDownIcon className="ml-2 size-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => {
        const duration = row.original.duration;
        return (
          <span className="font-mono text-sm">
            {formatSessionDuration(duration)}
          </span>
        );
      },
    },
    {
      accessorKey: "url",
      header: t("columns.page"),
      cell: ({ row }) => {
        const url = row.original.url;
        if (!url) return <span className="text-muted-foreground">-</span>;

        // Extract path from URL
        let path = url;
        try {
          const urlObj = new URL(url);
          path = urlObj.pathname + urlObj.search;
        } catch {
          // Keep original if not valid URL
        }

        // Truncate long paths
        const displayPath = path.length > 30 ? path.slice(0, 30) + "..." : path;

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[200px]">
                  <Globe className="h-3 w-3 shrink-0" />
                  <span className="truncate font-mono">{displayPath}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">{url}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "deviceType",
      header: t("columns.device"),
      cell: ({ row }) => {
        const deviceType = row.original.deviceType;
        const Icon = getDeviceIcon(deviceType);

        return (
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="hidden text-xs capitalize text-muted-foreground sm:inline">
              {t(`device.${deviceKey(deviceType)}`)}
            </span>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "environment",
      header: () => <div className="hidden md:block">{t("columns.environment")}</div>,
      cell: ({ row }) => {
        const { browser, os } = row.original;

        return (
          <div className="hidden items-center gap-1.5 md:flex">
            {browser && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {browser}
              </Badge>
            )}
            {os && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {os}
              </Badge>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "errorCount",
      header: ({ column }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-0"
          >
            {t("columns.errors")}
            {column.getIsSorted() === "asc" && (
              <ChevronUpIcon className="ml-2 size-4" />
            )}
            {column.getIsSorted() === "desc" && (
              <ChevronDownIcon className="ml-2 size-4" />
            )}
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const { errorCount, maxSeverity } = row.original;

        if (errorCount === 0) {
          return (
            <div className="flex items-center justify-end text-muted-foreground">
              <span className="text-sm">0</span>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm font-medium">{errorCount}</span>
            {maxSeverity && (
              <Badge
                variant={getSeverityColor(maxSeverity) as any}
                className="px-1.5 py-0 text-[10px] font-semibold uppercase"
              >
                {maxSeverity}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="w-8" />,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
              size="icon"
            >
              <ChevronDownIcon />
              <span className="sr-only">{t("actions.openMenu")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/${orgSlug}/${projectSlug}/replays/${row.original.id}`}>
                <PlayCircleIcon className="mr-2 size-4" />
                {t("actions.watchReplay")}
              </Link>
            </DropdownMenuItem>
            {row.original.errorFingerprints.length > 0 && (
              <DropdownMenuItem asChild>
                <Link
                  href={`/dashboard/${orgSlug}/${projectSlug}/issues/${row.original.errorFingerprints[0]}`}
                >
                  <AlertTriangle className="mr-2 size-4" />
                  {t("actions.viewIssue")}
                </Link>
              </DropdownMenuItem>
            )}
            {row.original.url && (
              <DropdownMenuItem
                onClick={() => window.open(row.original.url!, "_blank")}
              >
                <ExternalLink className="mr-2 size-4" />
                {t("actions.openPage")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
