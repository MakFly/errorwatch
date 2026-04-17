export type LogLevel = "debug" | "info" | "warning" | "error";
export type LogSource = "http" | "cli" | "messenger" | "deprecation" | "app";

export type ApplicationLog = {
  id: string;
  projectId: string;
  createdAt: Date;
  level: LogLevel;
  channel: string;
  message: string;
  context: Record<string, unknown> | null;
  extra: Record<string, unknown> | null;
  env: string | null;
  release: string | null;
  source: LogSource;
  url: string | null;
  requestId: string | null;
  userId: string | null;
  // Distributed tracing correlation (W3C traceparent)
  traceId: string | null;
  spanId: string | null;
  ingestedAt: Date;
};

export type LogsTailResponse = {
  items: ApplicationLog[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type LogsTailFilter = {
  projectId: string;
  limit?: number;
  cursor?: string;
  level?: LogLevel;
  channel?: string;
  search?: string;
};
