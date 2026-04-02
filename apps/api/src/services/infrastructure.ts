import { db } from "../db/connection";
import { systemMetrics } from "../db/schema";
import { sql } from "drizzle-orm";

export type DateRange = "1h" | "6h" | "24h" | "7d";

// db.execute returns rows array or { rows: [...] } depending on Drizzle version
function extractRows<T>(result: T[] | { rows: T[] }): T[] {
  const raw = (result as { rows?: T[] }).rows ?? result;
  return Array.isArray(raw) ? raw : [];
}

// --- Field mapping: DB format → frontend format ---

interface DbNetwork {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxPackets?: number;
  txPackets?: number;
  rxErrors?: number;
  txErrors?: number;
}

interface DbDisk {
  device: string;
  mountPoint: string;
  total: number;
  used: number;
  free: number;
}

function mapNetworks(raw: unknown): Array<{ interface: string; bytesSent: number; bytesRecv: number; packetsSent: number; packetsRecv: number }> | null {
  if (!Array.isArray(raw)) return null;
  return (raw as DbNetwork[]).map((n) => ({
    interface: n.interface,
    bytesSent: n.txBytes ?? 0,
    bytesRecv: n.rxBytes ?? 0,
    packetsSent: n.txPackets ?? 0,
    packetsRecv: n.rxPackets ?? 0,
  }));
}

function mapDisks(raw: unknown): Array<{ device: string; mountpoint: string; total: number; used: number; usedPercent: number }> | null {
  if (!Array.isArray(raw)) return null;
  return (raw as DbDisk[]).map((d) => ({
    device: d.device,
    mountpoint: d.mountPoint ?? (d as any).mountpoint ?? d.device,
    total: d.total,
    used: d.used,
    usedPercent: d.total > 0 ? Math.round((d.used / d.total) * 1000) / 10 : 0,
  }));
}

/** Ingested agent payloads omit `usedPercent`; derive it from used/total when missing. */
export function mapMemory(raw: unknown): {
  total: number;
  used: number;
  available: number;
  usedPercent: number;
  swapTotal: number;
  swapUsed: number;
} {
  const m = raw as {
    total?: number;
    used?: number;
    available?: number;
    usedPercent?: number;
    swapTotal?: number;
    swapUsed?: number;
  } | null;
  if (!m || typeof m !== "object") {
    return { total: 0, used: 0, available: 0, usedPercent: 0, swapTotal: 0, swapUsed: 0 };
  }
  const total = Number(m.total);
  const used = Number(m.used);
  const available = Number(m.available);
  const swapTotal = Number(m.swapTotal ?? 0);
  const swapUsed = Number(m.swapUsed ?? 0);
  const t = Number.isFinite(total) ? total : 0;
  const u = Number.isFinite(used) ? used : 0;
  const pctRaw = Number(m.usedPercent);
  const usedPercent =
    Number.isFinite(pctRaw) && pctRaw >= 0
      ? Math.min(100, pctRaw)
      : t > 0
        ? Math.round((u / t) * 1000) / 10
        : 0;
  return {
    total: t,
    used: u,
    available: Number.isFinite(available) ? available : 0,
    usedPercent,
    swapTotal: Number.isFinite(swapTotal) ? swapTotal : 0,
    swapUsed: Number.isFinite(swapUsed) ? swapUsed : 0,
  };
}

export interface HostInfo {
  hostId: string;
  hostname: string;
  os: string;
  architecture: string | null;
  lastSeen: Date;
}

export interface LatestMetric {
  hostId: string;
  hostname: string;
  cpu: unknown;
  memory: unknown;
  disks: unknown;
  networks: unknown;
  timestamp: Date;
}

export interface HistoryEntry {
  timestamp: Date;
  cpu: unknown;
  memory: unknown;
  disks: unknown;
  networks: unknown;
}

/**
 * Get unique hosts for a project with their latest info.
 */
export async function getHosts(projectId: string): Promise<HostInfo[]> {
  const rows = await db.execute<{
    host_id: string;
    hostname: string;
    os: string;
    architecture: string | null;
    last_seen: Date;
  }>(sql`
    SELECT DISTINCT ON (host_id)
      host_id,
      hostname,
      os,
      architecture,
      timestamp AS last_seen
    FROM system_metrics
    WHERE project_id = ${projectId}
    ORDER BY host_id, timestamp DESC
  `);

  return extractRows(rows).map((row) => ({
    hostId: row.host_id,
    hostname: row.hostname,
    os: row.os,
    architecture: row.architecture,
    lastSeen: row.last_seen,
  }));
}

/**
 * Get the latest snapshot per host for a project (overview widgets).
 */
export async function getLatest(projectId: string): Promise<LatestMetric[]> {
  const rows = await db.execute<{
    host_id: string;
    hostname: string;
    cpu: unknown;
    memory: unknown;
    disks: unknown;
    networks: unknown;
    timestamp: Date;
  }>(sql`
    SELECT DISTINCT ON (host_id)
      host_id,
      hostname,
      cpu,
      memory,
      disks,
      networks,
      timestamp
    FROM system_metrics
    WHERE project_id = ${projectId}
    ORDER BY host_id, timestamp DESC
  `);

  return extractRows(rows).map((row) => ({
    hostId: row.host_id,
    hostname: row.hostname,
    cpu: row.cpu,
    memory: mapMemory(row.memory),
    disks: mapDisks(row.disks),
    networks: mapNetworks(row.networks),
    timestamp: row.timestamp,
  }));
}

function getSince(dateRange: DateRange): string {
  const now = Date.now();
  const ms: Record<DateRange, number> = {
    "1h": 3_600_000,
    "6h": 21_600_000,
    "24h": 86_400_000,
    "7d": 604_800_000,
  };
  return new Date(now - ms[dateRange]).toISOString();
}

/**
 * Get time series data for a specific host.
 * - "1h" / "6h": raw data (no bucketing)
 * - "24h": 1-minute buckets
 * - "7d": 5-minute buckets
 *
 * For bucketed ranges, we pick the row closest to each bucket boundary
 * using DISTINCT ON + date_trunc, preserving full JSONB objects.
 */
export async function getHistory(
  projectId: string,
  hostId: string,
  dateRange: DateRange
): Promise<HistoryEntry[]> {
  const since = getSince(dateRange);

  if (dateRange === "1h" || dateRange === "6h") {
    const rows = await db.execute<{
      timestamp: Date;
      cpu: unknown;
      memory: unknown;
      disks: unknown;
      networks: unknown;
    }>(sql`
      SELECT timestamp, cpu, memory, disks, networks
      FROM system_metrics
      WHERE project_id = ${projectId}
        AND host_id = ${hostId}
        AND timestamp >= ${since}
      ORDER BY timestamp ASC
    `);

    return extractRows(rows).map((row) => ({
      timestamp: row.timestamp,
      cpu: row.cpu,
      memory: mapMemory(row.memory),
      disks: mapDisks(row.disks),
      networks: mapNetworks(row.networks),
    }));
  }

  // For 24h/7d: pick one representative row per bucket
  const truncInterval = dateRange === "24h" ? "minute" : "5 minutes";

  const rows = await db.execute<{
    timestamp: Date;
    cpu: unknown;
    memory: unknown;
    disks: unknown;
    networks: unknown;
  }>(sql`
    SELECT DISTINCT ON (bucket) bucket AS timestamp, cpu, memory, disks, networks
    FROM (
      SELECT
        date_trunc(${sql.raw(`'${truncInterval}'`)}, timestamp) AS bucket,
        cpu, memory, disks, networks,
        timestamp AS raw_ts
      FROM system_metrics
      WHERE project_id = ${projectId}
        AND host_id = ${hostId}
        AND timestamp >= ${since}
    ) sub
    ORDER BY bucket, raw_ts DESC
  `);

  return extractRows(rows).map((row) => ({
    timestamp: row.timestamp,
    cpu: row.cpu,
    memory: mapMemory(row.memory),
    disks: mapDisks(row.disks),
    networks: mapNetworks(row.networks),
  }));
}
