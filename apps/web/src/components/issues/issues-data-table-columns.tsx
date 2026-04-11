"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileCode2Icon,
  UsersIcon,
} from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { ErrorLevel } from "@/server/api"

export interface IssueGroup {
  fingerprint: string
  message: string
  file: string
  line: number
  url?: string | null
  level: ErrorLevel
  count: number
  usersAffected?: number
  firstSeen: Date
  lastSeen: Date
  hasReplay?: boolean
}

interface IssuesDataTableColumnsProps {
  orgSlug: string
  projectSlug: string
}

function getLevelColor(level: ErrorLevel): string {
  const levelLower = level.toLowerCase()
  switch (levelLower) {
    case "error":
      return "signal-error"
    case "fatal":
      return "signal-fatal"
    case "warning":
      return "signal-warning"
    case "info":
      return "signal-info"
    case "debug":
      return "signal-debug"
    default:
      return "outline"
  }
}

export function createIssuesColumns({
  orgSlug,
  projectSlug,
}: IssuesDataTableColumnsProps): ColumnDef<IssueGroup, any>[] {
  return [
    {
      accessorKey: "level",
      header: "Signal",
      cell: ({ row }) => {
        const level = row.getValue("level") as ErrorLevel
        const isCritical = level === "fatal" || level === "error"

        return (
          <div className="flex items-center gap-2">
            <div
              className={`size-2.5 rounded-full ${
                isCritical ? "animate-pulse" : ""
              } bg-${getLevelColor(level)}`}
            />
            <Badge variant={getLevelColor(level) as any} className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              {level}
            </Badge>
          </div>
        )
      },
      sortingFn: (a, b) => {
        const levelOrder = ["fatal", "error", "warning", "info", "debug"]
        const aLevel = a.original.level.toLowerCase()
        const bLevel = b.original.level.toLowerCase()
        return levelOrder.indexOf(aLevel) - levelOrder.indexOf(bLevel)
      },
    },
    {
      accessorKey: "message",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-0 text-left"
        >
          Message
          {column.getIsSorted() === "asc" && (
            <ChevronUpIcon className="ml-2 size-4" />
          )}
          {column.getIsSorted() === "desc" && (
            <ChevronDownIcon className="ml-2 size-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => {
        const { message, file, line, fingerprint } = row.original
        const maxLength = 80
        const truncatedMessage =
          message.length > maxLength
            ? message.slice(0, maxLength).trim() + "..."
            : message

        // Extract exception type prefix if present (e.g. "TypeError: ...")
        const colonIdx = message.indexOf(": ")
        const hasType = colonIdx > 0 && colonIdx < 40
        const exceptionType = hasType ? message.slice(0, colonIdx) : null
        const exceptionMsg = hasType ? message.slice(colonIdx + 2) : message
        const truncatedExceptionMsg =
          exceptionMsg.length > maxLength
            ? exceptionMsg.slice(0, maxLength).trim() + "..."
            : exceptionMsg

        const displayFile = file ? file.split("/").slice(-2).join("/") : null

        return (
          <Link
            href={`/dashboard/${orgSlug}/${projectSlug}/issues/${fingerprint}`}
            className="block min-w-0 max-w-[300px] lg:max-w-[500px] hover:text-foreground"
          >
            <span className="block truncate text-sm font-medium" title={message}>
              {exceptionType ? (
                <>
                  <span className="font-bold">{exceptionType}: </span>
                  {truncatedExceptionMsg}
                </>
              ) : (
                truncatedMessage
              )}
            </span>
            {displayFile && (
              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <FileCode2Icon className="size-3 shrink-0" />
                <span className="truncate font-mono">
                  {displayFile}:{line}
                </span>
              </span>
            )}
          </Link>
        )
      },
      size: 400,
      maxSize: 500,
    },
    {
      accessorKey: "count",
      header: ({ column }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-0"
          >
            Freq
            {column.getIsSorted() === "asc" && (
              <ChevronUpIcon className="ml-2 size-4" />
            )}
            {column.getIsSorted() === "desc" && (
              <ChevronDownIcon className="ml-2 size-4" />
            )}
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm font-medium">{row.original.count}</span>
          <span className="text-[10px] text-muted-foreground">events</span>
        </div>
      ),
    },
    {
      accessorKey: "usersAffected",
      header: ({ column }) => (
        <div className="hidden text-right lg:block">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-0"
          >
            Users
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
        const users = row.original.usersAffected ?? 0
        if (users === 0) return <div className="hidden lg:block" />
        return (
          <div className="hidden items-center justify-end gap-1.5 lg:flex">
            <UsersIcon className="size-3 text-muted-foreground" />
            <span className="text-sm font-medium">{users}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "lastSeen",
      header: ({ column }) => (
        <div className="hidden text-right sm:block">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-0"
          >
            Last
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
        const lastSeen = row.original.lastSeen
        return (
          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <span>
              {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: () => <div className="w-8" />,
      cell: ({ row }) => (
        <IssueActionsDropdown
          issue={row.original}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ]
}

function IssueActionsDropdown({
  issue,
  orgSlug,
  projectSlug,
}: {
  issue: IssueGroup
  orgSlug: string
  projectSlug: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
          size="icon"
        >
          <ChevronDownIcon />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/${orgSlug}/${projectSlug}/issues/${issue.fingerprint}`}>
            <ArrowRightIcon className="mr-2 size-4" />
            View Details
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
