/**
 * Event Controller
 * @description Handles error event submission from SDKs
 * Events are queued for async processing via BullMQ
 */
import type { Context } from "hono";
import type { AppEnv } from "../../types/hono";
import { z } from "zod";
import { createHash } from "crypto";
import logger from "../../logger";
import { canAcceptEvent, incrementQuotaCache } from "../../services/quotas";
import { getProjectPlan } from "../../services/subscriptions";
import { eventQueue } from "../../queue/queues";
import { isRedisAvailable, redis } from "../../queue/connection";
import { ProjectSettingsRepository } from "../../repositories/ProjectSettingsRepository";

// === Configuration ===
const isProduction = process.env.NODE_ENV === "production";

// === Validation Schema ===

// Breadcrumb schema for user action trail
const breadcrumbSchema = z.object({
  timestamp: z.number(),
  category: z.enum(['ui', 'navigation', 'console', 'http', 'user']),
  type: z.string().max(50).optional(),
  level: z.enum(['debug', 'info', 'warning', 'error']).optional(),
  message: z.string().max(1000).optional(),
  data: z.record(z.string(), z.any()).optional(),
});

// Structured stack frame schema (SDK provides these from parsed exceptions)
const frameSchema = z.object({
  filename: z.string().max(2000),
  function: z.string().max(500).nullable().optional(),
  lineno: z.number().int().nullable().optional(),
  colno: z.number().int().nullable().optional(),
  in_app: z.boolean().optional(),
  context_line: z.string().max(2000).nullable().optional(),
  pre_context: z.array(z.string().max(2000)).max(20).nullable().optional(),
  post_context: z.array(z.string().max(2000)).max(20).nullable().optional(),
});

const eventSchema = z.object({
  message: z.string().min(1).max(10000),
  file: z.string().min(1).max(1000),
  line: z.number().int().positive(),
  stack: z.string().min(1).max(100000),
  env: z.string().max(50).default("unknown"),
  url: z.string().url().max(2000).optional().nullable(),
  status_code: z.number().int().min(100).max(599).optional().nullable(),
  level: z.enum(["fatal", "error", "warning", "info", "debug"]).default("error"),
  created_at: z.number().default(() => Date.now()),
  // Breadcrumbs: array of user actions before the error
  breadcrumbs: z.array(breadcrumbSchema).max(100).optional(),
  // Session ID for session replay linking
  session_id: z.string().max(100).optional(),
  // Release version (e.g. "v1.2.3", "abc123")
  release: z.string().max(200).optional().nullable(),
  // User identifier for impact analysis
  user_id: z.string().max(200).optional().nullable(),
  // Structured stack frames parsed by the SDK (preferred over raw `stack`)
  frames: z.array(frameSchema).max(100).optional(),
  // Explicit fingerprint override (SDK-computed grouping key, 64 hex max)
  fingerprint: z.string().max(128).optional().nullable(),
  // Distributed tracing correlation (W3C traceparent)
  trace_id: z.string().max(64).optional().nullable(),
  span_id: z.string().max(32).optional().nullable(),
});

/**
 * Submit error event from SDK
 * Events are validated and queued for async processing
 */
export const submit = async (c: Context<AppEnv>) => {
  try {
    // Parse and validate input (fast, sync)
    const rawInput = await c.req.json();
    const input = eventSchema.parse(rawInput);

    // Get API key context
    const apiKeyData = c.get("apiKey");
    const projectId = apiKeyData?.projectId || null;

    if (!projectId) {
      return c.json({ error: "Invalid API key", code: "INVALID_API_KEY" }, 401);
    }

    // Check if event ingestion is enabled for this project
    const projectSettings = await ProjectSettingsRepository.findByProjectId(projectId);
    if (projectSettings && projectSettings.eventsEnabled === false) {
      logger.info("Event rejected - ingestion disabled", { projectId });
      return c.json(
        {
          error: "Event ingestion disabled",
          code: "INGESTION_DISABLED",
          message: "Event ingestion has been disabled for this project",
        },
        403
      );
    }

    // Apply server-side sample rate
    if (projectSettings?.sampleRate) {
      const rate = typeof projectSettings.sampleRate === "string" ? parseFloat(projectSettings.sampleRate) : projectSettings.sampleRate;
      if (rate < 1.0 && Math.random() >= rate) {
        logger.debug("Event dropped by sample rate", { projectId, sampleRate: rate });
        return c.json({ success: true, sampled: false }, 202);
      }
    }

    // Check quotas (sync - needed before accepting)
    const plan = await getProjectPlan(projectId);
    const quotaCheck = await canAcceptEvent(projectId, plan);
    if (!quotaCheck.allowed) {
      logger.warn("Event rejected due to quota", {
        projectId,
        reason: quotaCheck.reason,
      });
      return c.json(
        {
          error: "Quota exceeded",
          code: "QUOTA_EXCEEDED",
          message: quotaCheck.reason,
          quota: {
            used: quotaCheck.status.used,
            limit: quotaCheck.status.limit,
            percentage: quotaCheck.status.percentage,
          },
        },
        429
      );
    }

    // Check Redis availability
    const redisUp = await isRedisAvailable();
    if (!redisUp) {
      logger.error("Redis unavailable, cannot queue event");
      return c.json(
        { error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" },
        503
      );
    }

    // Dedup: check Redis for recent identical event (10s window)
    const dedupFingerprint = createHash("sha1")
      .update(`${projectId}|${input.message}|${input.file}|${input.line}`)
      .digest("hex");
    const dedupKey = `dedup:evt:${projectId}:${dedupFingerprint}`;
    const isDuplicate = await redis.get(dedupKey);
    if (isDuplicate) {
      logger.debug("Event deduplicated", { projectId, fingerprint: dedupFingerprint });
      return c.json({ success: true, deduplicated: true }, 202);
    }
    await redis.setex(dedupKey, 10, "1");

    // Normalize timestamp
    const createdAt =
      input.created_at < 1e12
        ? new Date(input.created_at * 1000)
        : new Date(input.created_at);

    // Only link replay for critical errors
    const shouldLinkReplay = ['fatal', 'error'].includes(input.level);

    // Deterministic jobId for BullMQ dedup (10s window)
    const jobId = `evt-${projectId}-${dedupFingerprint}-${Math.floor(Date.now() / 10000)}`;

    // Queue event for async processing (< 5ms)
    await eventQueue.add("process-event", {
      projectId,
      message: input.message,
      file: input.file,
      line: input.line,
      stack: input.stack,
      env: input.env,
      url: input.url || null,
      level: input.level,
      statusCode: input.status_code || null,
      breadcrumbs: input.breadcrumbs ? JSON.stringify(input.breadcrumbs) : null,
      sessionId: shouldLinkReplay ? (input.session_id || null) : null,
      createdAt: createdAt.toISOString(),
      release: input.release || null,
      userId: input.user_id || null,
      frames: input.frames,
      sdkFingerprint: input.fingerprint || null,
      traceId: input.trace_id || null,
      spanId: input.span_id || null,
    }, { jobId });

    logger.debug("Event queued", {
      projectId,
      level: input.level,
    });

    // Increment cached quota counter (fire-and-forget, non-blocking)
    incrementQuotaCache(projectId).catch(() => {
      // Quota cache increment failure is non-critical
    });

    // Respond immediately with 202 Accepted
    return c.json({ success: true, queued: true }, 202);

  } catch (e) {
    // Handle validation errors
    if (e instanceof z.ZodError) {
      if (isProduction) {
        logger.warn("Invalid error event input", {
          fieldCount: e.issues.length,
        });
        return c.json(
          { error: "Invalid input", code: "VALIDATION_ERROR" },
          400
        );
      }

      logger.warn("Invalid error event input", {
        issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
      return c.json(
        {
          error: "Invalid input",
          code: "VALIDATION_ERROR",
          details: e.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        400
      );
    }

    // Handle other errors
    logger.error("Failed to queue error event", {
      error: e instanceof Error ? e.message : "Unknown error",
      ...(isProduction ? {} : { stack: e instanceof Error ? e.stack : undefined }),
    });

    return c.json(
      {
        error: isProduction ? "Internal server error" : (e instanceof Error ? e.message : "Unknown error"),
        code: "INTERNAL_ERROR",
      },
      500
    );
  }
};
