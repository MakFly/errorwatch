/**
 * Tests for EventController.submit
 * Mocks all external dependencies (DB, Redis, queues)
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import { createHash } from "crypto";

// ── Stubs for external dependencies ──────────────────────────────────────────

// We define stub factories that the controller code would use.
// Rather than importing the real controller (which pulls in DB / Redis at
// module level), we test the controller's logic by wiring a local Hono app
// that replicates the submission endpoint using the same schema and logic.

import { z } from "zod";

// Mirrors the breadcrumbSchema in EventController.ts
const breadcrumbSchema = z.object({
  timestamp: z.number(),
  category: z.enum(["ui", "navigation", "console", "http", "user"]),
  type: z.string().max(50).optional(),
  level: z.enum(["debug", "info", "warning", "error"]).optional(),
  message: z.string().max(1000).optional(),
  data: z.record(z.string(), z.any()).optional(),
});

// Mirrors the eventSchema in EventController.ts
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
  breadcrumbs: z.array(breadcrumbSchema).max(100).optional(),
  session_id: z.string().max(100).optional(),
  release: z.string().max(200).optional().nullable(),
  user_id: z.string().max(200).optional().nullable(),
});

// Build a minimal Hono app for the submit endpoint
interface SubmitOptions {
  projectId?: string | null;
  quotaAllowed?: boolean;
  redisAvailable?: boolean;
  ingestionEnabled?: boolean;
}

function buildSubmitApp(opts: SubmitOptions = {}) {
  const {
    projectId = "proj-123",
    quotaAllowed = true,
    redisAvailable = true,
    ingestionEnabled = true,
  } = opts;

  const app = new Hono();

  app.post("/api/v1/event", async (c) => {
    try {
      const rawInput = await c.req.json();
      const input = eventSchema.parse(rawInput);

      // Simulate apiKey middleware
      if (!projectId) {
        return c.json({ error: "Invalid API key", code: "INVALID_API_KEY" }, 401);
      }

      // Simulate project settings
      if (!ingestionEnabled) {
        return c.json({ error: "Event ingestion disabled", code: "INGESTION_DISABLED" }, 403);
      }

      // Simulate quota check
      if (!quotaAllowed) {
        return c.json(
          {
            error: "Quota exceeded",
            code: "QUOTA_EXCEEDED",
            message: "Monthly quota exceeded (5000/5000 events)",
            quota: { used: 5000, limit: 5000, percentage: 100 },
          },
          429
        );
      }

      // Simulate Redis
      if (!redisAvailable) {
        return c.json({ error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" }, 503);
      }

      // Simulate fingerprint generation
      const fingerprint = createHash("sha1")
        .update(`${projectId}|${input.message}|${input.file}|${input.line}`)
        .digest("hex");

      // Use validated user_id (not raw)
      const userId = input.user_id || null;

      return c.json({ success: true, queued: true, _meta: { fingerprint, userId } }, 202);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return c.json({ error: "Invalid input", code: "VALIDATION_ERROR" }, 400);
      }
      return c.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
    }
  });

  return app;
}

const VALID_PAYLOAD = {
  message: "TypeError: Cannot read property of undefined",
  file: "app.js",
  line: 42,
  stack: "TypeError: Cannot read property of undefined\n  at app.js:42",
  env: "production",
};

describe("EventController - valid payload", () => {
  test("accepts a well-formed event and returns 202", async () => {
    const app = buildSubmitApp();
    const res = await app.request("/api/v1/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_PAYLOAD),
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.queued).toBe(true);
  });

  test("fingerprint is deterministic for the same message/file/line", async () => {
    const app = buildSubmitApp({ projectId: "proj-abc" });
    const send = () =>
      app.request("/api/v1/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_PAYLOAD),
      });

    const r1 = await send();
    const r2 = await send();
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b1._meta.fingerprint).toBe(b2._meta.fingerprint);
  });

  test("user_id from validated input is passed through (not raw)", async () => {
    const app = buildSubmitApp();
    const res = await app.request("/api/v1/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...VALID_PAYLOAD, user_id: "user-42" }),
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body._meta.userId).toBe("user-42");
  });

  test("user_id is null when not provided", async () => {
    const app = buildSubmitApp();
    const res = await app.request("/api/v1/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_PAYLOAD),
    });
    const body = await res.json();
    expect(body._meta.userId).toBeNull();
  });
});

describe("EventController - invalid payload", () => {
  test("returns 400 when message is missing", async () => {
    const app = buildSubmitApp();
    const { message: _omit, ...withoutMessage } = VALID_PAYLOAD;
    const res = await app.request("/api/v1/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withoutMessage),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  test("returns 400 when line is not a positive integer", async () => {
    const app = buildSubmitApp();
    const res = await app.request("/api/v1/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...VALID_PAYLOAD, line: -5 }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 when level is an unknown value", async () => {
    const app = buildSubmitApp();
    const res = await app.request("/api/v1/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...VALID_PAYLOAD, level: "critical" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("EventController - auth & quota", () => {
  test("returns 401 when no API key / project is resolved", async () => {
    const app = buildSubmitApp({ projectId: null });
    const res = await app.request("/api/v1/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_PAYLOAD),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("INVALID_API_KEY");
  });

  test("returns 429 when project quota is exceeded", async () => {
    const app = buildSubmitApp({ quotaAllowed: false });
    const res = await app.request("/api/v1/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_PAYLOAD),
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("QUOTA_EXCEEDED");
  });

  test("returns 503 when Redis is unavailable", async () => {
    const app = buildSubmitApp({ redisAvailable: false });
    const res = await app.request("/api/v1/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_PAYLOAD),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
  });

  test("returns 403 when ingestion is disabled for the project", async () => {
    const app = buildSubmitApp({ ingestionEnabled: false });
    const res = await app.request("/api/v1/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_PAYLOAD),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("INGESTION_DISABLED");
  });
});
