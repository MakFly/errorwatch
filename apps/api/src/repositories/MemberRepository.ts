import { eq, and } from "drizzle-orm";
import { db } from "../db/connection";
import { organizationMembers, users, invitations, organizations } from "../db/schema";

export const MemberRepository = {
  findByOrganizationId: (organizationId: string, executor: any = db) =>
    executor
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        createdAt: organizationMembers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(organizationMembers)
      .leftJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, organizationId))
      ,

  findMemberByOrgAndUser: (organizationId: string, userId: string, executor: any = db) =>
    executor
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId)
        )
      )
      .then((rows: any[]) => rows[0]),

  findById: (id: string, executor: any = db) =>
    executor
      .select({
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        organizationId: organizationMembers.organizationId,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.id, id))
      .then((rows: any[]) => rows[0]),

  delete: (id: string, executor: any = db) =>
    executor.delete(organizationMembers).where(eq(organizationMembers.id, id)),

  createMembership: (data: {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: Date;
  }, executor: any = db) => executor.insert(organizationMembers).values(data),
};

export const InvitationRepository = {
  create: (data: {
    id: string;
    organizationId: string;
    email: string;
    role: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
  }, executor: any = db) => executor.insert(invitations).values(data),

  findByToken: (token: string, executor: any = db) =>
    executor
      .select({
        id: invitations.id,
        organizationId: invitations.organizationId,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
      })
      .from(invitations)
      .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
      .where(eq(invitations.token, token))
      .then((rows: any[]) => rows[0]),

  findByTokenSimple: (token: string, executor: any = db) =>
    executor.select().from(invitations).where(eq(invitations.token, token)).then((rows: any[]) => rows[0]),

  delete: (token: string, executor: any = db) =>
    executor.delete(invitations).where(eq(invitations.token, token)),
};
