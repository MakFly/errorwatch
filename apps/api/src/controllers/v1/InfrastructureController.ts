import type { AuthContext } from "../../types/context";
import { verifyProjectAccess } from "../../services/project-access";
import * as InfrastructureService from "../../services/infrastructure";
import type { DateRange } from "../../services/infrastructure";
import logger from "../../logger";
import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const encoder = new TextEncoder();

export const getHosts = async (c: AuthContext) => {
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json({ error: "projectId query parameter required" }, 400);
  }

  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    logger.warn("User attempted to access infrastructure hosts without project permission", { userId, projectId });
    return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
  }

  try {
    const hosts = await InfrastructureService.getHosts(projectId);
    return c.json(hosts);
  } catch (error) {
    logger.error("Failed to get infrastructure hosts", { error, projectId });
    return c.json({ error: "Internal server error" }, 500);
  }
};

export const getLatest = async (c: AuthContext) => {
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json({ error: "projectId query parameter required" }, 400);
  }

  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    logger.warn("User attempted to access infrastructure latest metrics without project permission", { userId, projectId });
    return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
  }

  try {
    const latest = await InfrastructureService.getLatest(projectId);
    return c.json(latest);
  } catch (error) {
    logger.error("Failed to get latest infrastructure metrics", { error, projectId });
    return c.json({ error: "Internal server error" }, 500);
  }
};

export const getHistory = async (c: AuthContext) => {
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");
  const hostId = c.req.query("hostId");
  const dateRange = (c.req.query("dateRange") ?? "1h") as DateRange;

  if (!projectId) {
    return c.json({ error: "projectId query parameter required" }, 400);
  }

  if (!hostId) {
    return c.json({ error: "hostId query parameter required" }, 400);
  }

  const validRanges: DateRange[] = ["1h", "6h", "24h", "7d"];
  if (!validRanges.includes(dateRange)) {
    return c.json({ error: "dateRange must be one of: 1h, 6h, 24h, 7d" }, 400);
  }

  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    logger.warn("User attempted to access infrastructure history without project permission", { userId, projectId });
    return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
  }

  try {
    const history = await InfrastructureService.getHistory(projectId, hostId, dateRange);
    return c.json(history);
  } catch (error) {
    logger.error("Failed to get infrastructure history", { error, projectId, hostId, dateRange });
    return c.json({ error: "Internal server error" }, 500);
  }
};

/**
 * SSE stream for real-time infrastructure metrics (session auth).
 */
export const stream = async (c: AuthContext) => {
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json({ error: "projectId query parameter required" }, 400);
  }

  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const subClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
  });

  let closed = false;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let onMessage: ((channel: string, message: string) => void) | null = null;

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    if (pingInterval) clearInterval(pingInterval);
    if (onMessage) subClient.off("message", onMessage);
    await subClient.unsubscribe().catch(() => {});
    await subClient.quit().catch(() => {});
  };

  function toSseFrame(event: string, data: string): string {
    return `event: ${event}\ndata: ${data}\n\n`;
  }

  /**
   * Map raw DB field names to frontend-expected names in SSE payloads.
   */
  function mapSsePayload(raw: any): any {
    const mapped = { ...raw };
    if (raw.memory != null) {
      mapped.memory = InfrastructureService.mapMemory(raw.memory);
    }
    if (Array.isArray(raw.networks)) {
      mapped.networks = raw.networks.map((n: any) => ({
        interface: n.interface,
        bytesSent: n.txBytes ?? 0,
        bytesRecv: n.rxBytes ?? 0,
        packetsSent: n.txPackets ?? 0,
        packetsRecv: n.rxPackets ?? 0,
      }));
    }
    if (Array.isArray(raw.disks)) {
      mapped.disks = raw.disks.map((d: any) => ({
        device: d.device,
        mountpoint: d.mountPoint ?? d.mountpoint ?? d.device,
        total: d.total,
        used: d.used,
        usedPercent: d.total > 0 ? Math.round((d.used / d.total) * 1000) / 10 : 0,
      }));
    }
    return mapped;
  }

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await subClient.subscribe(`sse:metrics:${projectId}`);
      } catch (err) {
        logger.warn("Infrastructure SSE subscribe failed", { projectId, error: err });
        await cleanup();
        controller.close();
        return;
      }

      onMessage = (_channel, message) => {
        if (closed) return;
        try {
          const parsed = JSON.parse(message);
          const mapped = mapSsePayload(parsed);
          controller.enqueue(encoder.encode(toSseFrame("metrics", JSON.stringify(mapped))));
        } catch {
          void cleanup();
        }
      };
      subClient.on("message", onMessage);

      pingInterval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(toSseFrame("ping", "")));
        } catch {
          void cleanup();
        }
      }, 15_000);

      c.req.raw.signal?.addEventListener("abort", () => {
        void cleanup();
        try { controller.close(); } catch {}
      }, { once: true });
    },
    async cancel() {
      await cleanup();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};
