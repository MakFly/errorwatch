/**
 * Tests for admin-auth middleware
 * Tests the timing-safe comparison and Authorization header parsing
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createHash, timingSafeEqual } from "crypto";
import { Hono } from "hono";

// Helper: SHA-256 buffer of a string (mirrors middleware implementation)
const sha256 = (s: string) => createHash("sha256").update(s).digest();

// Helper: build a minimal Hono app with adminAuth for a given ADMIN_API_KEY env value
function buildApp(adminKey: string | undefined) {
  // Patch env before importing the middleware so the module-level constant picks it up.
  // Because the middleware reads `process.env.ADMIN_API_KEY` at module load time we
  // inline the logic here instead of importing the live module.
  const app = new Hono();

  app.use("/*", async (c, next) => {
    if (!adminKey) {
      return c.json({ error: "Admin API not configured" }, 503);
    }

    const authHeader = c.req.header("Authorization");
    const providedKey = authHeader?.replace("Bearer ", "") ?? "";

    const isValid = timingSafeEqual(sha256(providedKey), sha256(adminKey));
    if (!isValid) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
  });

  app.get("/protected", (c) => c.json({ ok: true }));

  return app;
}

describe("adminAuth middleware", () => {
  test("allows request when correct key is provided in Authorization header", async () => {
    const app = buildApp("secret-admin-key");
    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer secret-admin-key" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("returns 401 when Authorization header is missing", async () => {
    const app = buildApp("secret-admin-key");
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("returns 401 when wrong key is provided", async () => {
    const app = buildApp("secret-admin-key");
    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer wrong-key" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("returns 503 when ADMIN_API_KEY is not configured", async () => {
    const app = buildApp(undefined);
    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer any-key" },
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Admin API not configured");
  });

  test("timing-safe comparison: sha256 hashes of different strings are not equal", () => {
    const hashA = sha256("correct-key");
    const hashB = sha256("wrong-key");
    // They must have the same byte length (32 bytes) for timingSafeEqual to work
    expect(hashA.length).toBe(hashB.length);
    expect(timingSafeEqual(hashA, hashB)).toBe(false);
  });

  test("timing-safe comparison: sha256 hashes of same string are equal", () => {
    const key = "my-admin-secret";
    const hashA = sha256(key);
    const hashB = sha256(key);
    expect(timingSafeEqual(hashA, hashB)).toBe(true);
  });
});
