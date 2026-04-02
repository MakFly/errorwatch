import type { AuthContext } from "../../types/context";
import type { Context } from "hono";
import { z } from "zod";
import { MemberService } from "../../services/MemberService";

export const getByOrganization = async (c: AuthContext) => {
  const userId = c.get("userId");
  const organizationId = c.req.param("organizationId");

  try {
    const members = await MemberService.getByOrganization(userId, organizationId);
    return c.json(members);
  } catch (error: any) {
    if (error.message === "Not a member of this organization") {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: error.message || "Failed to get members" }, 500);
  }
};

export const invite = async (c: AuthContext) => {
  const userId = c.get("userId");
  const { organizationId, email, method } = await c.req.json();

  try {
    if (method === "direct") {
      const result = await MemberService.inviteDirect(userId, organizationId, email);
      return c.json(result);
    }
    const result = await MemberService.invite(userId, organizationId, email);
    return c.json(result);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: error.message || "Failed to invite member" }, 500);
  }
};

export const checkInvite = async (c: Context) => {
  const token = c.req.param("token");

  try {
    const result = await MemberService.checkInvite(token);
    return c.json(result);
  } catch (error: any) {
    if (error.message === "Invitation not found") {
      return c.json({ valid: false, error: error.message }, 404);
    }
    if (error.message === "Invitation expired") {
      return c.json({ valid: false, error: error.message }, 400);
    }
    return c.json({ valid: false, error: error.message || "Failed to check invitation" }, 500);
  }
};

export const redeemInvite = async (c: Context) => {
  const schema = z.object({
    token: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    password: z.string().min(8).max(200),
  });

  try {
    const { token, name, password } = schema.parse(await c.req.json());
    const result = await MemberService.redeemInvite(token, name, password);
    return c.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.issues }, 400);
    }
    if (
      error.message === "Invitation not found" ||
      error.message === "Invitation expired" ||
      error.message === "Name is required"
    ) {
      return c.json({ error: error.message }, error.message === "Invitation not found" ? 404 : 400);
    }
    if (error.message === "Account already exists for this invitation") {
      return c.json({ error: error.message }, 409);
    }
    return c.json({ error: error.message || "Failed to redeem invitation" }, 500);
  }
};

export const acceptInvite = async (c: AuthContext) => {
  const userId = c.get("userId");
  const { token } = await c.req.json();

  try {
    const result = await MemberService.acceptInvite(userId, token);
    return c.json(result);
  } catch (error: any) {
    if (error.message === "Invitation not found") {
      return c.json({ error: error.message }, 404);
    }
    if (error.message === "Invitation expired") {
      return c.json({ error: error.message }, 400);
    }
    if (error.message === "Invitation email does not match current user") {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: error.message || "Failed to accept invitation" }, 500);
  }
};

export const remove = async (c: AuthContext) => {
  const currentUserId = c.get("userId");
  const id = c.req.param("id");

  try {
    const result = await MemberService.remove(currentUserId, id);
    return c.json(result);
  } catch (error: any) {
    if (error.message === "Member not found") {
      return c.json({ error: error.message }, 404);
    }
    if (error.message === "Cannot remove owner" || error.message === "Unauthorized") {
      return c.json({ error: error.message }, error.message === "Cannot remove owner" ? 400 : 403);
    }
    return c.json({ error: error.message || "Failed to remove member" }, 500);
  }
};
