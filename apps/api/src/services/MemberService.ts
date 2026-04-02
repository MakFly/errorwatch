import { MemberRepository, InvitationRepository } from "../repositories/MemberRepository";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { UserRepository } from "../repositories/UserRepository";
import { sendInvitationEmail } from "./email";
import logger from "../logger";
import { db } from "../db/connection";
import { createCredentialUser, setCredentialPassword } from "./auth-users";

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3001";

export const MemberService = {
  getByOrganization: async (userId: string, organizationId: string) => {
    const requester = await MemberRepository.findMemberByOrgAndUser(organizationId, userId);
    if (!requester) {
      throw new Error("Not a member of this organization");
    }

    const members = await MemberRepository.findByOrganizationId(organizationId);
    return members.map((m: any) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt,
      user: { name: m.userName, email: m.userEmail },
    }));
  },

  invite: async (userId: string, organizationId: string, email: string) => {
    const member = await MemberRepository.findMemberByOrgAndUser(organizationId, userId);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("Unauthorized");
    }

    const organization = await OrganizationRepository.findById(organizationId);
    const inviter = await UserRepository.findById(userId);

    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await InvitationRepository.create({
      id: crypto.randomUUID(),
      organizationId,
      email: email.toLowerCase(),
      role: "member",
      token: inviteToken,
      expiresAt,
      createdAt: new Date(),
    });

    const inviteUrl = `${DASHBOARD_URL}/invite/${inviteToken}`;

    const emailResult = await sendInvitationEmail({
      to: email.toLowerCase(),
      inviterName: inviter?.name || inviter?.email || "A team member",
      organizationName: organization?.name || "an organization",
      inviteUrl,
      expiresIn: "7 days",
    });

    if (!emailResult.success) {
      logger.warn("Failed to send invitation email, but invitation created", {
        email,
        error: emailResult.error,
      });
    }

    return {
      inviteUrl,
      inviteToken,
      emailSent: emailResult.success,
    };
  },

  inviteDirect: async (userId: string, organizationId: string, email: string) => {
    const member = await MemberRepository.findMemberByOrgAndUser(organizationId, userId);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("Unauthorized");
    }

    let existingUser = await UserRepository.findByEmail(email.toLowerCase());
    let tempPassword: string | null = null;
    let userCreated = false;

    if (!existingUser) {
      tempPassword = crypto.randomUUID().slice(0, 12);
      const createdUser = await createCredentialUser({
        name: email.split("@")[0],
        email: email.toLowerCase(),
        password: tempPassword,
      });
      existingUser = await UserRepository.findById(createdUser.id);
      if (!existingUser) {
        throw new Error("Failed to create invited user");
      }
      userCreated = true;
    } else {
      tempPassword = crypto.randomUUID().slice(0, 12);
      await setCredentialPassword({
        userId: existingUser.id,
        password: tempPassword,
      });
    }

    const existingMember = await MemberRepository.findMemberByOrgAndUser(organizationId, existingUser.id);
    if (existingMember) {
      throw new Error("User is already a member of this organization");
    }

    await MemberRepository.createMembership({
      id: crypto.randomUUID(),
      organizationId,
      userId: existingUser.id,
      role: "member",
      createdAt: new Date(),
    });

    return {
      success: true,
      message: `User ${email} added as member. Temp password: ${tempPassword}`,
      userCreated,
      tempPassword,
    };
  },

  checkInvite: async (token: string) => {
    const invitation = await InvitationRepository.findByToken(token);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      throw new Error("Invitation expired");
    }

    return {
      valid: true,
      organizationId: invitation.organizationId,
      organizationName: invitation.organizationName,
      organizationSlug: invitation.organizationSlug,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      hasAccount: !!(await UserRepository.findByEmail(invitation.email)),
    };
  },

  acceptInvite: async (userId: string, token: string) => {
    const invitation = await InvitationRepository.findByTokenSimple(token);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      throw new Error("Invitation expired");
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("Invitation email does not match current user");
    }

    const existingMember = await MemberRepository.findMemberByOrgAndUser(invitation.organizationId, userId);
    if (existingMember) {
      await InvitationRepository.delete(token);
      return { success: true };
    }

    await MemberRepository.createMembership({
      id: crypto.randomUUID(),
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
      createdAt: new Date(),
    });

    await InvitationRepository.delete(token);
    return { success: true };
  },

  redeemInvite: async (token: string, name: string, password: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error("Name is required");
    }

    return db.transaction(async (tx) => {
      const invitation = await InvitationRepository.findByTokenSimple(token, tx);
      if (!invitation) {
        throw new Error("Invitation not found");
      }

      if (new Date(invitation.expiresAt).getTime() < Date.now()) {
        throw new Error("Invitation expired");
      }

      const existingUser = await UserRepository.findByEmail(invitation.email);
      if (existingUser) {
        throw new Error("Account already exists for this invitation");
      }

      const user = await createCredentialUser(
        {
          name: normalizedName,
          email: invitation.email,
          password,
        },
        tx
      );

      await MemberRepository.createMembership(
        {
          id: crypto.randomUUID(),
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
          createdAt: new Date(),
        },
        tx
      );

      await InvitationRepository.delete(token, tx);

      return {
        success: true,
        user: {
          email: user.email,
          name: user.name,
        },
      };
    });
  },

  remove: async (currentUserId: string, memberId: string) => {
    const member = await MemberRepository.findById(memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    if (member.userId === currentUserId && member.role === "owner") {
      throw new Error("Cannot remove owner");
    }

    const requester = await MemberRepository.findMemberByOrgAndUser(
      member.organizationId,
      currentUserId
    );
    if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
      throw new Error("Unauthorized");
    }

    await MemberRepository.delete(memberId);
    return { success: true };
  },
};
