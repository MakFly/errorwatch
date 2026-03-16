import { db } from "../db/connection";
import { errorEvents, projects } from "../db/schema";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import logger from "../logger";
import { redis } from "../queue/connection";

import type { QuotaStatus, PlanType } from "../types/services";

const QUOTA_CACHE_TTL = 60; // seconds

function quotaCacheKey(projectId: string): string {
  return `quota:events:${projectId}`;
}
// Default quotas per plan
export const PLAN_QUOTAS = {
  free: {
    eventsPerMonth: 5000,
    retentionDays: 7,
    projects: 1,
    organizations: 1,
    users: 1,
  },
  pro: {
    eventsPerMonth: 100000,
    retentionDays: 30,
    projects: -1, // unlimited
    organizations: -1,
    users: 5,
  },
  team: {
    eventsPerMonth: 500000,
    retentionDays: 90,
    projects: -1,
    organizations: -1,
    users: -1,
  },
  enterprise: {
    eventsPerMonth: -1, // unlimited
    retentionDays: 365,
    projects: -1,
    organizations: -1,
    users: -1,
  },
};

/**
 * Get the start of the current billing month
 */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Get current month's event count for a project (Redis-cached, TTL 60s)
 */
export async function getMonthlyEventCount(projectId: string): Promise<number> {
  const cacheKey = quotaCacheKey(projectId);

  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return parseInt(cached, 10);
    }
  } catch (err) {
    logger.warn("Quota cache read failed, falling back to DB", { projectId, error: err });
  }

  const monthStart = getMonthStart();

  const result = (await db
    .select({ count: sql<number>`count(*)` })
    .from(errorEvents)
    .where(
      and(
        eq(errorEvents.projectId, projectId),
        gte(errorEvents.createdAt, monthStart)
      )
    ))[0];

  const count = result?.count || 0;

  try {
    await redis.setex(cacheKey, QUOTA_CACHE_TTL, String(count));
  } catch (err) {
    logger.warn("Quota cache write failed", { projectId, error: err });
  }

  return count;
}

/**
 * Increment cached quota counter after accepting an event.
 * No-op if the key doesn't exist (will be refreshed on next read).
 */
export async function incrementQuotaCache(projectId: string): Promise<void> {
  const cacheKey = quotaCacheKey(projectId);
  try {
    // INCR only works if key already exists; if missing, the next read will repopulate from DB
    const exists = await redis.exists(cacheKey);
    if (exists) {
      await redis.incr(cacheKey);
    }
  } catch (err) {
    logger.warn("Quota cache increment failed", { projectId, error: err });
  }
}

/**
 * Check quota status for a project
 */
export async function checkQuotaStatus(
  projectId: string,
  plan: PlanType = "free"
): Promise<QuotaStatus> {
  const used = await getMonthlyEventCount(projectId);
  const limit = PLAN_QUOTAS[plan].eventsPerMonth;

  // Unlimited quota
  if (limit === -1) {
    return {
      used,
      limit: -1,
      percentage: 0,
      exceeded: false,
      remaining: -1,
    };
  }

  const percentage = Math.round((used / limit) * 100);
  const exceeded = used >= limit;
  const remaining = Math.max(0, limit - used);

  return {
    used,
    limit,
    percentage,
    exceeded,
    remaining,
  };
}

/**
 * Check if an event can be accepted (quota not exceeded)
 */
export async function canAcceptEvent(
  projectId: string,
  plan: PlanType = "free"
): Promise<{ allowed: boolean; reason?: string; status: QuotaStatus }> {
  const status = await checkQuotaStatus(projectId, plan);

  if (status.exceeded) {
    logger.warn("Quota exceeded for project", { projectId, used: status.used, limit: status.limit });
    return {
      allowed: false,
      reason: `Monthly quota exceeded (${status.used}/${status.limit} events)`,
      status,
    };
  }

  // Warn when approaching limit (80%)
  if (status.percentage >= 80) {
    logger.info("Approaching quota limit", { projectId, percentage: status.percentage });
  }

  return { allowed: true, status };
}

/**
 * Get quota usage for all projects in an organization
 */
export async function getOrganizationQuotaUsage(
  organizationId: string,
  plan: PlanType = "free"
): Promise<{
  totalUsed: number;
  projectUsage: Array<{ projectId: string; projectName: string; used: number }>;
}> {
  const monthStart = getMonthStart();

  // Get all projects for the organization
  const orgProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));

  if (orgProjects.length === 0) {
    return { totalUsed: 0, projectUsage: [] };
  }

  // Single GROUP BY query instead of N sequential COUNT queries
  const projectIds = orgProjects.map((p) => p.id);
  const counts = await db
    .select({
      projectId: errorEvents.projectId,
      count: sql<number>`count(*)`,
    })
    .from(errorEvents)
    .where(
      and(
        inArray(errorEvents.projectId, projectIds),
        gte(errorEvents.createdAt, monthStart)
      )
    )
    .groupBy(errorEvents.projectId);

  const countMap = new Map(counts.map((row) => [row.projectId, row.count]));

  const projectUsage: Array<{ projectId: string; projectName: string; used: number }> = [];
  let totalUsed = 0;

  for (const project of orgProjects) {
    const used = countMap.get(project.id) ?? 0;
    projectUsage.push({
      projectId: project.id,
      projectName: project.name,
      used,
    });
    totalUsed += used;
  }

  return { totalUsed, projectUsage };
}
