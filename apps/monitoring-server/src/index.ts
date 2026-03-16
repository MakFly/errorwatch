import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import logger from "./logger";
import { logApiCall } from "./api-logger";
import { sessionMiddleware } from "./middleware/session";
import { securityHeaders } from "./middleware/security-headers";
import { rateLimit } from "./middleware/rate-limit";
import api from "./routes";

// === Startup Environment Validation ===
const REQUIRED_ENV_VARS = ["API_KEY_HASH_SECRET"] as const;
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const app = new Hono();

// === Environment Configuration ===
const isProduction = process.env.NODE_ENV === "production";
const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:4000";
const apiUrl = process.env.API_URL || process.env.BETTER_AUTH_URL || "http://localhost:3333";

// Trusted origins for CORS
const trustedOrigins = isProduction
  ? [dashboardUrl, apiUrl].filter(Boolean)
  : [
      "http://localhost:3000",
      "http://localhost:4000",
      "http://localhost:3002",
      dashboardUrl,
    ].filter(Boolean);
const isLocalDevOrigin = (origin: string) =>
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
const corsOrigin = isProduction
  ? trustedOrigins
  : (origin: string) => {
      if (!origin) return null;
      if (trustedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
        return origin;
      }
      return null;
    };

// === Global Middleware ===

// 1. Security Headers (first - applies to all responses)
app.use("*", securityHeaders());

// 2. Body size limits for SDK endpoints
app.use("/api/v1/event", async (c, next) => {
  const contentLength = parseInt(c.req.header('content-length') || '0', 10);
  if (contentLength > 5 * 1024 * 1024) {
    return c.json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, 413);
  }
  await next();
});

// 3. CORS - SDK endpoints allow all origins (protected by API key)
// Event and replay ingestion endpoints can receive requests from any client domain
app.use("/api/v1/event", cors({
  origin: "*",
  allowMethods: ["POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "X-API-Key", "X-Content-Encoding", "X-Session-ID"],
}));
// Error-triggered replay endpoint (new Sentry-like architecture)
app.use("/api/v1/replay/error", cors({
  origin: "*",
  allowMethods: ["POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "X-API-Key", "X-Content-Encoding", "X-Session-ID"],
}));
// Legacy replay endpoints (kept for backwards compatibility)
app.use("/api/v1/replay/session/start", cors({
  origin: "*",
  allowMethods: ["POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "X-API-Key", "X-Content-Encoding"],
}));
app.use("/api/v1/replay/session/events", cors({
  origin: "*",
  allowMethods: ["POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "X-API-Key", "X-Content-Encoding"],
}));
app.use("/api/v1/replay/session/end", cors({
  origin: "*",
  allowMethods: ["POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "X-API-Key", "X-Content-Encoding"],
}));

// 3. CORS - Dashboard endpoints (restricted to trusted origins)
app.use("/sse", cors({
  origin: corsOrigin,
  allowMethods: ["GET", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Cookie"],
  credentials: true,
}));

app.use("*", cors({
  origin: corsOrigin,
  allowMethods: ["GET", "POST", "OPTIONS", "DELETE", "PATCH"],
  allowHeaders: ["Content-Type", "X-API-Key", "Authorization"],
  credentials: true,
}));

// 4. Global rate limiting (prevent DDoS)
app.use("*", rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000,   // 1000 requests per minute per IP
  skip: (c) => c.req.method === "OPTIONS", // Skip preflight requests
}));

// 5. API Logger middleware - logs all requests with timing and metrics
import { recordHttpRequest as recordMetric } from "./metrics";

app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const duration = Math.round(performance.now() - start);

  // Skip logging for OPTIONS preflight requests
  if (c.req.method === 'OPTIONS') return;

  const url = new URL(c.req.url);
  const path = url.pathname;

  // Log API call
  logApiCall({
    method: c.req.method,
    path,
    status: c.res.status,
    duration,
    hasAuth: !!(c.req.header('Cookie') || c.req.header('Authorization') || c.req.header('X-API-Key')),
  });

  // Record Prometheus metrics
  recordMetric(c.req.method, path, c.res.status, duration);
});

// 6. Session middleware - inject user session in context
app.use("*", sessionMiddleware);

// === Error Handler ===
app.onError((err, c) => {
  // Log error details (but mask in production)
  logger.error("Unhandled error", {
    message: err.message,
    path: c.req.path,
    method: c.req.method,
    // Only include stack in development
    ...(isProduction ? {} : { stack: err.stack }),
  });

  // Return generic error in production
  return c.json(
    {
      error: isProduction ? "Internal server error" : err.message,
      code: "INTERNAL_ERROR",
    },
    500
  );
});

// === SSE (Server-Sent Events) ===
import sseRoute from "./sse/route";
app.route("/sse", sseRoute);

// === API Versioning ===
// Mount versioned API
app.route("/api", api);

// === Health check ===
app.get("/", (c) => {
  return c.json({
    name: "ErrorWatch API",
    version: "1.0.0",
    apiVersions: ["v1"],
    currentVersion: "v1",
    docs: "/api/v1",
  });
});

// === Health endpoints for Kubernetes/Docker ===
// Import health check utilities
import { checkDatabaseHealth, closeDatabase } from "./db/connection";
import { isRedisHealthy } from "./queue/connection";

// Liveness probe - is the process alive and responding?
app.get("/health/live", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe - is the service ready to accept traffic?
app.get("/health/ready", async (c) => {
  const timeout = 5000; // 5 second timeout for checks
  const startTime = Date.now();

  const checks: Record<string, { status: "ok" | "error"; latency?: number; error?: string }> = {};
  let allHealthy = true;

  // Check PostgreSQL
  try {
    const dbStart = Date.now();
    const dbHealthy = await Promise.race([
      checkDatabaseHealth(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeout)
      ),
    ]);
    checks.database = {
      status: dbHealthy ? "ok" : "error",
      latency: Date.now() - dbStart,
    };
    if (!dbHealthy) allHealthy = false;
  } catch (err) {
    checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
    allHealthy = false;
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    const redisHealthy = await Promise.race([
      isRedisHealthy(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeout)
      ),
    ]);
    checks.redis = {
      status: redisHealthy ? "ok" : "error",
      latency: Date.now() - redisStart,
    };
    if (!redisHealthy) allHealthy = false;
  } catch (err) {
    checks.redis = {
      status: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
    allHealthy = false;
  }

  const response = {
    status: allHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    totalLatency: Date.now() - startTime,
    checks,
  };

  return c.json(response, allHealthy ? 200 : 503);
});

// Legacy health endpoint (for backwards compatibility)
app.get("/health", async (c) => {
  // Quick check - just verify process is responding
  // For full check, use /health/ready
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// === Prometheus Metrics ===
import { register, recordHttpRequest } from "./metrics";

app.get("/metrics", async (c) => {
  try {
    const metrics = await register.metrics();
    c.header("Content-Type", register.contentType);
    return c.text(metrics);
  } catch (err) {
    logger.error("Failed to generate metrics", { error: err });
    return c.text("Error generating metrics", 500);
  }
});

// === Server Start ===
const port = parseInt(process.env.PORT || "3333", 10);

serve({
  fetch: app.fetch,
  port,
});

logger.info(`🚀 Monitoring Server running on http://localhost:${port}`, {
  port,
  env: process.env.NODE_ENV || 'development',
  apiVersions: ['v1'],
  trustedOrigins: trustedOrigins.length,
});

// === BullMQ Workers ===
// Start workers for async event processing
import { eventWorker } from "./queue/workers/event.worker";
import { replayWorker } from "./queue/workers/replay.worker";
import { alertWorker } from "./queue/workers/alert.worker";
import { aggregationWorker, scheduleAggregationJobs } from "./queue/workers/aggregation.worker";
import { metricsWorker } from "./queue/workers/metrics.worker";
import { isRedisAvailable } from "./queue/connection";

// Check Redis and start workers
(async () => {
  const redisAvailable = await isRedisAvailable();
  if (redisAvailable) {
    // Schedule aggregation cron jobs
    await scheduleAggregationJobs();

    logger.info("🔄 BullMQ workers started", {
      queues: ["events", "replays", "alerts", "aggregation", "metrics"],
      eventConcurrency: eventWorker.opts.concurrency,
      replayConcurrency: replayWorker.opts.concurrency,
      alertConcurrency: alertWorker.opts.concurrency,
      aggregationConcurrency: aggregationWorker.opts.concurrency,
      metricsConcurrency: metricsWorker.opts.concurrency,
    });
  } else {
    logger.warn("⚠️ Redis not available - workers not started. Events will fail to queue.");
  }
})();

// === Graceful Shutdown ===
import { closeRedis } from "./queue/connection";
import { closeRateLimiter } from "./middleware/rate-limit";
import { closePubClient } from "./sse/publisher";

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Close workers first (stop processing new jobs)
    logger.info("Closing workers...");
    await Promise.all([
      eventWorker.close(),
      replayWorker.close(),
      alertWorker.close(),
      aggregationWorker.close(),
      metricsWorker.close(),
    ]);
    logger.info("Workers closed");

    // Close SSE pub client
    logger.info("Closing SSE publisher...");
    await closePubClient();

    // Close rate limiter Redis connection
    logger.info("Closing rate limiter...");
    await closeRateLimiter();

    // Close queue Redis connection
    logger.info("Closing Redis...");
    await closeRedis();

    // Close database connection
    logger.info("Closing database...");
    await closeDatabase();

    clearTimeout(shutdownTimeout);
    logger.info("Graceful shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error("Error during shutdown", { error: err });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
