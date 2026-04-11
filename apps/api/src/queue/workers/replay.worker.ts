/**
 * Replay Worker
 * @description Processes session replay data from the queue
 */
import { Worker, Job } from "bullmq";
import { createHash } from "crypto";
import { eq, sql } from "drizzle-orm";
import { gunzipSync } from "zlib";
import { redisConnection } from "../connection";
import { alertQueue, type ReplayJobData } from "../queues";
import { db } from "../../db/connection";
import { errorGroups, errorEvents, replaySessions, sessionEvents, projects } from "../../db/schema";
import logger from "../../logger";
import { scrubPII } from "../../services/scrubber";
import { publishEvent } from "../../sse/publisher";

const WORKER_CONCURRENCY = parseInt(process.env.REPLAY_WORKER_CONCURRENCY || "5", 10);

/**
 * Parse user agent to extract device info
 */
function parseUserAgent(userAgent?: string): { deviceType: "desktop" | "mobile" | "tablet"; browser: string; os: string } {
  if (!userAgent) {
    return { deviceType: "desktop", browser: "Unknown", os: "Unknown" };
  }

  const ua = userAgent.toLowerCase();

  // Device type
  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = "mobile";
  } else if (/ipad|tablet|playbook|silk/i.test(ua)) {
    deviceType = "tablet";
  }

  // Browser
  let browser = "Unknown";
  if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("safari")) browser = "Safari";
  else if (ua.includes("opera") || ua.includes("opr")) browser = "Opera";

  // OS
  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  return { deviceType, browser, os };
}

/**
 * Decompress replay events
 */
function decompressEvents(compressedBase64: string): unknown[] {
  try {
    const buffer = Buffer.from(compressedBase64, "base64");
    const decompressed = gunzipSync(buffer);
    return JSON.parse(decompressed.toString("utf-8"));
  } catch {
    // Fallback: plain base64 JSON
    try {
      const decoded = Buffer.from(compressedBase64, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch {
      return [];
    }
  }
}

/**
 * Process a single replay job
 */
async function processReplay(job: Job<ReplayJobData>): Promise<{ fingerprint: string | null; sessionCreated: boolean }> {
  const { projectId, sessionId, events, error, url, userAgent, timestamp, release } = job.data;

  const now = new Date();
  const errorTime = new Date(timestamp);
  const deviceInfo = parseUserAgent(userAgent ?? undefined);

  // Only capture replays for critical errors
  const REPLAY_ELIGIBLE_LEVELS = ['fatal', 'error'];
  const shouldCaptureReplay = REPLAY_ELIGIBLE_LEVELS.includes(error.level);

  // Check if session already exists
  const existingSession = (await db
    .select({ id: replaySessions.id, projectId: replaySessions.projectId })
    .from(replaySessions)
    .where(eq(replaySessions.id, sessionId)))[0];

  let sessionCreated = false;
  let eventCount = 0;

  // === Verify session ownership for subsequent errors ===
  if (existingSession && existingSession.projectId !== projectId) {
    throw new Error("Session does not belong to project");
  }

  // === Create error group + event FIRST (to get errorEventId) ===
  let fingerprint: string | null = null;
  let errorEventId: string | null = null;

  if (error.message) {
    const file = error.file || url || "unknown";
    const line = error.line || 0;

    // Scrub PII from error data
    const scrubbedMessage = scrubPII(error.message);
    const scrubbedStack = error.stack ? scrubPII(error.stack) : scrubbedMessage;

    fingerprint = createHash("sha1")
      .update(`${projectId}|${error.message}|${file}|${line}`)
      .digest("hex");

    // Upsert error group
    const result = await db
      .insert(errorGroups)
      .values({
        fingerprint,
        projectId,
        message: scrubbedMessage,
        file,
        line,
        url: url || null,
        level: error.level,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      })
      .onConflictDoUpdate({
        target: errorGroups.fingerprint,
        set: {
          count: sql`${errorGroups.count} + 1`,
          lastSeen: now,
        },
      })
      .returning({ count: errorGroups.count });

    const isNewGroup = result[0]?.count === 1;

    // Create error event (generate ID first, catch unique constraint violation)
    errorEventId = crypto.randomUUID();
    try {
      await db.insert(errorEvents).values({
        id: errorEventId,
        fingerprint,
        projectId,
        stack: scrubbedStack,
        url: url || null,
        env: "production",
        level: error.level,
        sessionId: shouldCaptureReplay && (existingSession || events) ? sessionId : null,
        release: release || null,
        createdAt: now,
      });
    } catch (e: any) {
      if (e?.code === "23505") {
        logger.debug("Duplicate error event ignored", { fingerprint, projectId });
        return { fingerprint, sessionCreated: false };
      }
      throw e;
    }

    // Queue alert job
    await alertQueue.add("check-alerts", {
      projectId,
      fingerprint,
      isNewGroup,
      level: error.level,
      message: error.message,
    });
  }

  // === Create replay session if needed ===
  if (!existingSession && events && shouldCaptureReplay) {
    await db.insert(replaySessions).values({
      id: sessionId,
      projectId,
      userId: null,
      startedAt: new Date(errorTime.getTime() - 60000),
      endedAt: errorTime,
      duration: 60000,
      url: url || null,
      userAgent: userAgent || null,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      createdAt: now,
    });
    sessionCreated = true;
    logger.info("Created replay session", { sessionId, projectId });
  }

  // === Store replay events for EVERY error (Sentry-like: each error has its own replay snapshot) ===
  // Note: Store events even without errorEventId - fallback query by sessionId will work
  if (events && shouldCaptureReplay) {
    let eventType = 3;
    try {
      const decompressed = decompressEvents(events);
      if (Array.isArray(decompressed) && decompressed.length > 0) {
        eventCount = decompressed.length;
        const firstEvent = decompressed[0] as { type?: number };
        if (firstEvent.type === 2) {
          eventType = 2;
        }
      }
    } catch {
      // Continue with defaults
    }

    try {
      await db.insert(sessionEvents).values({
        id: crypto.randomUUID(),
        sessionId,
        errorEventId, // Link replay events to specific error (may be null)
        type: eventType,
        data: events,
        timestamp: new Date(timestamp),
      });

      logger.info("Stored replay events", { sessionId, errorEventId, eventCount, hasErrorEventId: !!errorEventId });
    } catch (e: any) {
      if (e?.code === "23505") {
        logger.debug("Duplicate session event ignored", { sessionId, errorEventId });
      } else {
        throw e;
      }
    }
  }

  // Publish SSE event for replay (fire-and-forget)
  if (sessionCreated) {
    const project = await db
      .select({ organizationId: projects.organizationId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project[0]?.organizationId) {
      publishEvent(project[0].organizationId, {
        type: "replay:new",
        projectId,
        payload: { sessionId },
        timestamp: Date.now(),
      });
    }
  }

  logger.debug("Processed replay", { jobId: job.id, fingerprint, sessionCreated });

  return { fingerprint, sessionCreated };
}

/**
 * Replay worker instance
 */
export const replayWorker = new Worker<ReplayJobData>(
  "replays",
  processReplay,
  {
    ...redisConnection,
    concurrency: WORKER_CONCURRENCY,
  }
);

replayWorker.on("completed", (job) => {
  logger.debug("Replay job completed", { jobId: job.id });
});

replayWorker.on("failed", (job, err) => {
  logger.error("Replay job failed", {
    jobId: job?.id,
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

replayWorker.on("error", (err) => {
  logger.error("Replay worker error", { error: err.message });
});

export default replayWorker;
