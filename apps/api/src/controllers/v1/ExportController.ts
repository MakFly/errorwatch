import type { AuthContext } from "../../types/context";
import { db } from "../../db/connection";
import { errorGroups, errorEvents, transactions } from "../../db/schema";
import { verifyProjectAccess } from "../../services/project-access";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import logger from "../../logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Format = "csv" | "json";
type DateRange = "24h" | "7d" | "30d";

const DATE_RANGE_MS: Record<DateRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const MAX_ROWS = 10_000;

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (val: unknown) => {
    const str = String(val ?? "");
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

function parseDateRange(value: string | undefined): DateRange {
  if (value === "24h" || value === "7d" || value === "30d") return value;
  return "7d";
}

function parseFormat(value: string | undefined): Format {
  if (value === "json") return "json";
  return "csv";
}

function dateTag(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Export Errors
// ---------------------------------------------------------------------------

export const exportErrors = async (c: AuthContext) => {
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");
  const format = parseFormat(c.req.query("format"));
  const dateRange = parseDateRange(c.req.query("dateRange"));
  if (!projectId) {
    return c.json({ error: "projectId is required" }, 400);
  }

  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    logger.warn("User attempted to export errors without project permission", { userId, projectId });
    return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
  }

  const since = new Date(Date.now() - DATE_RANGE_MS[dateRange]);

  // Build conditions
  const conditions = [
    eq(errorGroups.projectId, projectId),
    gte(errorGroups.lastSeen, since),
  ];
  // Query error groups with latest event environment via subquery
  const rows = await db
    .select({
      fingerprint: errorGroups.fingerprint,
      message: errorGroups.message,
      file: errorGroups.file,
      line: errorGroups.line,
      level: errorGroups.level,
      count: errorGroups.count,
      usersAffected: errorGroups.usersAffected,
      firstSeen: errorGroups.firstSeen,
      lastSeen: errorGroups.lastSeen,
      environment: sql<string>`(
        SELECT ${errorEvents.env}
        FROM ${errorEvents}
        WHERE ${errorEvents.fingerprint} = ${errorGroups.fingerprint}
        ORDER BY ${errorEvents.createdAt} DESC
        LIMIT 1
      )`.as("environment"),
    })
    .from(errorGroups)
    .where(and(...conditions))
    .orderBy(desc(errorGroups.lastSeen))
    .limit(MAX_ROWS);

  logger.debug("Export errors", { projectId, format, dateRange, rowCount: rows.length });

  const filename = `errors-export-${dateTag()}.${format}`;
  const headers = [
    "fingerprint", "message", "file", "line", "level",
    "count", "usersAffected", "firstSeen", "lastSeen", "environment",
  ];

  if (format === "json") {
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    c.header("Content-Type", "application/json");
    return c.body(JSON.stringify(rows, null, 2));
  }

  // CSV
  const csvData = toCsv(headers, rows as Record<string, unknown>[]);
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  c.header("Content-Type", "text/csv");
  return c.body(csvData);
};

// ---------------------------------------------------------------------------
// Export Performance
// ---------------------------------------------------------------------------

export const exportPerformance = async (c: AuthContext) => {
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");
  const format = parseFormat(c.req.query("format"));
  const dateRange = parseDateRange(c.req.query("dateRange"));

  if (!projectId) {
    return c.json({ error: "projectId is required" }, 400);
  }

  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    logger.warn("User attempted to export performance without project permission", { userId, projectId });
    return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
  }

  const since = new Date(Date.now() - DATE_RANGE_MS[dateRange]);

  const rows = await db
    .select({
      id: transactions.id,
      name: transactions.name,
      op: transactions.op,
      status: transactions.status,
      duration: transactions.duration,
      env: transactions.env,
      startTimestamp: transactions.startTimestamp,
      endTimestamp: transactions.endTimestamp,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        gte(transactions.startTimestamp, since),
      )
    )
    .orderBy(desc(transactions.startTimestamp))
    .limit(MAX_ROWS);

  logger.debug("Export performance", { projectId, format, dateRange, rowCount: rows.length });

  const filename = `performance-export-${dateTag()}.${format}`;
  const headers = [
    "id", "name", "op", "status", "duration", "env", "startTimestamp", "endTimestamp",
  ];

  if (format === "json") {
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    c.header("Content-Type", "application/json");
    return c.body(JSON.stringify(rows, null, 2));
  }

  // CSV
  const csvData = toCsv(headers, rows as Record<string, unknown>[]);
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  c.header("Content-Type", "text/csv");
  return c.body(csvData);
};
