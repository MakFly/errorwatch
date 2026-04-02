import { eq, and } from "drizzle-orm";
import { db } from "../db/connection";
import { organizations, organizationMembers } from "../db/schema";

export const OrganizationRepository = {
  hasAnyOrganization: (executor: any = db) =>
    executor
      .select({ id: organizations.id })
      .from(organizations)
      .limit(1)
      .then((rows: any[]) => rows.length > 0),

  findByUserId: (userId: string) =>
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: organizationMembers.role,
        createdAt: organizations.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId)
      )
      .where(eq(organizationMembers.userId, userId))
      ,

  findById: (id: string) =>
    db.select().from(organizations).where(eq(organizations.id, id)).then(rows => rows[0]),

  create: (data: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
  }) => db.insert(organizations).values(data).returning().then(rows => rows[0]),

  delete: (id: string) =>
    db.delete(organizations).where(eq(organizations.id, id)),

  findMembershipByUserId: (userId: string) =>
    db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1)
      ,

  createMembership: (data: {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: Date;
  }) => db.insert(organizationMembers).values(data),

  findOwnerByOrgId: (organizationId: string, userId: string) =>
    db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.role, "owner")
        )
      )
      .then(rows => rows[0]),
};
