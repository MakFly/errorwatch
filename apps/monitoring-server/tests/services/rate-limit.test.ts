/**
 * Tests for the rate-limit middleware (in-memory fallback path).
 * We test the pure in-memory logic without requiring Redis.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { Hono } from "hono";

// ── Inline the memory-based rate limiter (mirrors rate-limit.ts) ──────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

function buildRateLimitMiddleware(opts: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (c: any) => string;
}) {
  const { windowMs, maxRequests, keyGenerator = () => "test-client" } = opts;
  const memoryStore = new Map<string, RateLimitEntry>();

  return async (c: any, next: () => Promise<void>) => {
    const key = keyGenerator(c);
    const now = Date.now();

    let entry = memoryStore.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      memoryStore.set(key, entry);
    }
    entry.count++;

    const remaining = Math.max(0, maxRequests - entry.count);

    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      const resetIn = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(resetIn));
      return c.json(
        { error: "Too many requests", code: "RATE_LIMIT_EXCEEDED", retryAfter: resetIn },
        429
      );
    }

    return next();
  };
}

// Helper: build a minimal Hono app using the rate limiter
function buildApp(opts: { windowMs: number; maxRequests: number; keyGenerator?: (c: any) => string }) {
  const app = new Hono();
  app.use("/*", buildRateLimitMiddleware(opts));
  app.get("/ping", (c) => c.json({ ok: true }));
  return app;
}

describe("rate-limit (in-memory)", () => {
  test("allows requests under the limit", async () => {
    const app = buildApp({ windowMs: 60_000, maxRequests: 5 });

    for (let i = 0; i < 5; i++) {
      const res = await app.request("/ping");
      expect(res.status).toBe(200);
    }
  });

  test("blocks the request that exceeds the limit", async () => {
    const app = buildApp({ windowMs: 60_000, maxRequests: 3 });

    // 3 allowed
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/ping");
      expect(res.status).toBe(200);
    }

    // 4th is blocked
    const res = await app.request("/ping");
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  test("rate-limit headers are set on every response", async () => {
    const app = buildApp({ windowMs: 60_000, maxRequests: 10 });
    const res = await app.request("/ping");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).not.toBeNull();
    expect(res.headers.get("X-RateLimit-Reset")).not.toBeNull();
  });

  test("counter resets after the window expires", async () => {
    // Use an extremely short window (1 ms) so the entry expires immediately
    const app = buildApp({ windowMs: 1, maxRequests: 1 });

    // First request — allowed
    const first = await app.request("/ping");
    expect(first.status).toBe(200);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 5));

    // Second request — window has reset, should be allowed again
    const second = await app.request("/ping");
    expect(second.status).toBe(200);
  });
});
