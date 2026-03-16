import { db } from "../db/connection";
import { users, projects, organizationMembers } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import logger from "../logger";
import { PLAN_QUOTAS } from "./quotas";
import type { SubscriptionCheck, OrganizationSubscriptionCheck, PlanType } from "../types/services";

/**
 * Check if running in self-hosted mode (all users get enterprise access)
 */
export function isSelfHosted(): boolean {
  return process.env.SELF_HOSTED === "true";
}

// Bypass emails - these users have unlimited access regardless of plan
const BYPASS_EMAILS = (process.env.SUBSCRIPTION_BYPASS_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Get the user's current plan from the database
 */
export async function getUserPlan(userId: string): Promise<PlanType> {
  if (isSelfHosted()) return "enterprise";

  const user = (await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId)))[0];

  return (user?.plan as PlanType) || "free";
}

/**
 * Check if user email is in the bypass list
 */
export async function isUserBypassed(userId: string): Promise<boolean> {
  if (isSelfHosted()) return true;

  const user = (await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId)))[0];

  return user ? BYPASS_EMAILS.includes(normalizeEmail(user.email)) : false;
}

/**
 * Get count of projects owned by user (where user is owner of the organization)
 */
export async function getUserProjectCount(userId: string): Promise<number> {
  const result = (await db
    .select({ count: sql<number>`count(DISTINCT ${projects.id})` })
    .from(projects)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, projects.organizationId),
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.role, "owner")
      )
    ))[0];

  return result?.count || 0;
}

/**
 * Get count of organizations owned by user
 */
export async function getUserOrganizationCount(userId: string): Promise<number> {
  const result = (await db
    .select({ count: sql<number>`count(DISTINCT ${organizationMembers.organizationId})` })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.role, "owner")
      )
    ))[0];

  return result?.count || 0;
}

/**
 * Check if user can create a new project based on subscription
 */
export async function canCreateProject(userId: string): Promise<SubscriptionCheck> {
  if (isSelfHosted()) {
    return { allowed: true, currentCount: 0, maxProjects: -1, isBypassed: true, plan: "enterprise" };
  }

  const plan = await getUserPlan(userId);
  const isBypassed = await isUserBypassed(userId);
  const currentCount = await getUserProjectCount(userId);
  const maxProjects = PLAN_QUOTAS[plan as keyof typeof PLAN_QUOTAS]?.projects ?? 1;

  // Bypassed users can always create
  if (isBypassed) {
    logger.info("User bypassed subscription check", { userId });
    return {
      allowed: true,
      currentCount,
      maxProjects: -1, // unlimited
      isBypassed: true,
      plan,
    };
  }

  // Unlimited plans (maxProjects === -1)
  if (maxProjects === -1) {
    return {
      allowed: true,
      currentCount,
      maxProjects,
      isBypassed: false,
      plan,
    };
  }

  // Check limit
  if (currentCount >= maxProjects) {
    logger.info("User reached project limit", { userId, currentCount, maxProjects, plan });
    return {
      allowed: false,
      reason: `Your ${plan} plan is limited to ${maxProjects} project${maxProjects > 1 ? 's' : ''}. Upgrade to Pro for unlimited projects.`,
      currentCount,
      maxProjects,
      isBypassed: false,
      plan,
    };
  }

  return {
    allowed: true,
    currentCount,
    maxProjects,
    isBypassed: false,
    plan,
  };
}

/**
 * Check if user can create a new organization based on subscription
 */
export async function canCreateOrganization(userId: string): Promise<OrganizationSubscriptionCheck> {
  if (isSelfHosted()) {
    return { allowed: true, currentCount: 0, maxOrganizations: -1, isBypassed: true, plan: "enterprise" };
  }

  const plan = await getUserPlan(userId);
  const isBypassed = await isUserBypassed(userId);
  const currentCount = await getUserOrganizationCount(userId);
  const maxOrganizations = PLAN_QUOTAS[plan as keyof typeof PLAN_QUOTAS]?.organizations ?? 1;

  // Bypassed users can always create
  if (isBypassed) {
    logger.info("User bypassed organization subscription check", { userId });
    return {
      allowed: true,
      currentCount,
      maxOrganizations: -1,
      isBypassed: true,
      plan,
    };
  }

  // Unlimited plans (maxOrganizations === -1)
  if (maxOrganizations === -1) {
    return {
      allowed: true,
      currentCount,
      maxOrganizations,
      isBypassed: false,
      plan,
    };
  }

  // Check limit
  if (currentCount >= maxOrganizations) {
    logger.info("User reached organization limit", { userId, currentCount, maxOrganizations, plan });
    return {
      allowed: false,
      reason: `Your ${plan} plan is limited to ${maxOrganizations} organization${maxOrganizations > 1 ? 's' : ''}. Upgrade to Pro for unlimited organizations.`,
      currentCount,
      maxOrganizations,
      isBypassed: false,
      plan,
    };
  }

  return {
    allowed: true,
    currentCount,
    maxOrganizations,
    isBypassed: false,
    plan,
  };
}

/**
 * Resolve plan for a project (uses organization owner plan, with bypass support).
 */
export async function getProjectPlan(projectId: string): Promise<PlanType> {
  if (isSelfHosted()) return "enterprise";

  const owner = (await db
    .select({ plan: users.plan, email: users.email })
    .from(projects)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, projects.organizationId),
        eq(organizationMembers.role, "owner")
      )
    )
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(projects.id, projectId)))[0];

  if (!owner) {
    return "free";
  }

  if (BYPASS_EMAILS.includes(normalizeEmail(owner.email))) {
    return "enterprise";
  }

  return (owner.plan as PlanType) || "free";
}
