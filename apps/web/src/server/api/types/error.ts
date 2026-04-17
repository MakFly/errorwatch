import type { Pagination } from './common';

export type ErrorLevel = "fatal" | "error" | "warning" | "info" | "debug";
/** @deprecated Status lifecycle removed from frontend. Kept for API layer compatibility. */
export type IssueStatus = "unresolved" | "resolved" | "archived";

export type ErrorGroup = {
  fingerprint: string;
  projectId: string | null;
  message: string;
  file: string;
  line: number;
  statusCode: number | null;
  level: ErrorLevel;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  assignedTo: string | null;
  assignedAt: Date | null;
  hasReplay?: boolean;
  latestReplaySessionId?: string | null;
  latestReplayEventId?: string | null;
  latestReplayCreatedAt?: Date | null;
  // v2 enriched fields
  exceptionType?: string;
  exceptionValue?: string;
};

export type ErrorEvent = {
  id: string;
  fingerprint: string;
  projectId: string | null;
  stack: string;
  url: string | null;
  env: string;
  statusCode: number | null;
  level: ErrorLevel;
  breadcrumbs: string | null;
  sessionId: string | null;
  release: string | null;
  createdAt: Date;
  // v2 enriched fields
  exceptionType?: string;
  exceptionValue?: string;
  platform?: string;
  serverName?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  userContext?: {
    id?: string;
    email?: string;
    ip_address?: string;
    username?: string;
  };
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    query_string?: string;
    data?: unknown;
  };
  contexts?: {
    os?: { name?: string; version?: string };
    browser?: { name?: string; version?: string };
    runtime?: { name?: string; version?: string };
    [key: string]: unknown;
  };
  sdk?: { name: string; version: string };
  frames?: Array<{
    filename: string;
    function?: string | null;
    lineno?: number | null;
    colno?: number | null;
    in_app?: boolean;
    context_line?: string | null;
    pre_context?: string[] | null;
    post_context?: string[] | null;
  }>;
  fingerprintVersion?: number;
  // Distributed tracing correlation (W3C traceparent)
  traceId?: string | null;
  spanId?: string | null;
};

export type ReleaseDistribution = {
  releases: Array<{
    version: string;
    count: number;
    percentage: number;
  }>;
  firstSeenIn: string | null;
};

export type EventsResponse = {
  events: ErrorEvent[];
  pagination: Pagination;
};

export type GroupsFilter = {
  env?: string;
  dateRange?: "24h" | "7d" | "30d" | "90d" | "all";
  projectId?: string;
  search?: string;
  level?: "fatal" | "error" | "warning" | "info" | "debug";
  levels?: string[];
  sort?: "lastSeen" | "firstSeen" | "count";
  page?: number;
  limit?: number;
};

