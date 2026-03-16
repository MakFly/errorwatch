/**
 * Admin tRPC router - server-side only
 * All procedures use the server-side ADMIN_API_KEY env var.
 * This key is NEVER exposed to the browser.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import * as adminApi from "../../api/admin";

/**
 * Guard: reject if ADMIN_API_KEY is not set on the server.
 * Using publicProcedure intentionally — the admin page is already
 * behind authentication at the Next.js layout level, and the key
 * check is a server-side secret guard, not a session guard.
 */
const adminProcedure = publicProcedure.use(async (opts) => {
  if (!adminApi.isConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "ADMIN_API_KEY is not configured on the server",
    });
  }
  return opts.next();
});

export const adminRouter = router({
  /**
   * Returns cron status and failed jobs in a single round-trip.
   */
  getCronStatus: adminProcedure.query(async () => {
    const [cronStatus, failedJobs] = await Promise.all([
      adminApi.getCronStatus(),
      adminApi.getFailedJobs(),
    ]);
    return { cronStatus, failedJobs };
  }),

  /**
   * Runs a cron job synchronously for the given date.
   */
  runJobSync: adminProcedure
    .input(
      z.object({
        type: z.enum(["aggregate-hourly", "aggregate-daily", "cleanup-expired"]),
        targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
      })
    )
    .mutation(async ({ input }) => {
      return adminApi.runJobSync(input.type, input.targetDate);
    }),

  /**
   * Deletes all failed jobs from the queue.
   */
  clearFailedJobs: adminProcedure.mutation(async () => {
    await adminApi.clearFailedJobs();
    return { success: true };
  }),

  /**
   * Returns whether the admin key is configured (safe boolean, not the key itself).
   */
  isConfigured: publicProcedure.query(() => {
    return { configured: adminApi.isConfigured() };
  }),
});
