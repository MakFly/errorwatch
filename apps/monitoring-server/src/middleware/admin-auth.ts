import type { MiddlewareHandler } from "hono";
import { createHash, timingSafeEqual } from "crypto";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

const sha256 = (s: string) => createHash("sha256").update(s).digest();

export const adminAuth = (): MiddlewareHandler => {
  return async (c, next) => {
    if (!ADMIN_KEY) {
      return c.json({ error: "Admin API not configured" }, 503);
    }

    const authHeader = c.req.header("Authorization");
    const providedKey = authHeader?.replace("Bearer ", "") ?? "";

    const isValid = timingSafeEqual(sha256(providedKey), sha256(ADMIN_KEY));
    if (!isValid) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
  };
};

