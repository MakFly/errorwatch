/**
 * Dev-only routes - only available in development mode
 */
import { Hono } from "hono";
import { auth } from "../../middleware/auth";
import { adminAuth } from "../../middleware/admin-auth";
import { db } from "../../db/connection";
import { errorGroups, errorEvents, replaySessions, sessionEvents, users } from "../../db/schema";
import logger from "../../logger";

const router = new Hono();

// Block all routes in production
router.use("*", async (c, next) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }
  await next();
});

/**
 * List users (email, name) - admin auth required, for login page autofill in dev
 */
router.get("/users", adminAuth(), async (c) => {
  const rows = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .orderBy(users.createdAt);
  return c.json(rows);
});

/**
 * Reset error tracking tables (dev only)
 * Clears: error_groups, error_events, replay_sessions, session_events
 */
router.post("/reset-tables", auth(), async (c) => {
  try {
    logger.warn("DEV: Resetting error tracking tables");

    // Delete in correct order (foreign key constraints)
    await db.delete(sessionEvents);
    await db.delete(errorEvents);
    await db.delete(errorGroups);
    await db.delete(replaySessions);

    logger.info("DEV: Tables reset successfully");

    return c.json({
      success: true,
      message: "All error tracking tables have been reset",
      tables: ["error_groups", "error_events", "replay_sessions", "session_events"],
    });
  } catch (error) {
    logger.error("DEV: Failed to reset tables", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return c.json(
      { error: "Failed to reset tables", details: error instanceof Error ? error.message : "Unknown" },
      500
    );
  }
});

export default router;
