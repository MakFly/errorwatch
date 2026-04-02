import { API_BASE, fetchAPI } from './client';
import type { Member, Invite } from './types';

export const getByOrganization = async (organizationId: string): Promise<Member[]> => {
  return fetchAPI<Member[]>(`/members/organization/${organizationId}`);
};

export const invite = async (organizationId: string, email: string, method: "token" | "direct" = "token"): Promise<Invite> => {
  return fetchAPI<Invite>("/members/invite", {
    method: "POST",
    body: JSON.stringify({ organizationId, email, method }),
  });
};

export const checkInvite = async (token: string): Promise<{
  valid: boolean;
  organizationId?: string;
  organizationName?: string;
  organizationSlug?: string;
  email?: string;
  role?: string;
  expiresAt?: Date;
  hasAccount?: boolean;
  error?: string;
}> => {
  const response = await fetch(`${API_BASE}/members/check/${token}`, {
    credentials: "include",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      valid: false,
      error: data?.error || "Invalid or expired invitation",
    };
  }

  return data;
};

export const acceptInvite = async (token: string): Promise<{ success: boolean }> => {
  return fetchAPI<{ success: boolean }>("/members/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
};

export const redeemInvite = async (
  token: string,
  name: string,
  password: string
): Promise<{ success: boolean; user: { email: string; name: string } }> => {
  return fetchAPI<{ success: boolean; user: { email: string; name: string } }>("/members/redeem", {
    method: "POST",
    body: JSON.stringify({ token, name, password }),
  });
};

export const remove = async (memberId: string): Promise<{ success: boolean }> => {
  return fetchAPI<{ success: boolean }>(`/members/${memberId}`, {
    method: "DELETE",
  });
};
