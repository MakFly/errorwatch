/**
 * REST API client utilities
 * Using API v1
 */

import { logApiCall, createApiTimer } from '@/lib/api-logger';
import { getInternalMonitoringApiUrl } from '@/lib/config';

export const API_VERSION = "v1";

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export function getApiUrl(): string {
  return getInternalMonitoringApiUrl();
}

export function getApiBase(): string {
  return `${getApiUrl()}/api/${API_VERSION}`;
}

export async function fetchAPI<T>(endpoint: string, options?: RequestInit & { cookie?: string }): Promise<T> {
  const apiUrl = getApiUrl();
  const apiBase = getApiBase();

  // Determine if endpoint is already versioned or needs base URL
  const url = endpoint.startsWith("/api/")
    ? `${apiUrl}${endpoint}`
    : `${apiBase}${endpoint}`;

  const method = (options?.method || 'GET') as HttpMethod;
  const body = options?.body ? JSON.parse(options.body as string) : undefined;
  const getElapsedTime = createApiTimer();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  // Forward cookie if provided, or try to get from server-side cookies
  if (options?.cookie) {
    headers["Cookie"] = options.cookie;
  } else {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll().map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; ");
      if (allCookies) {
        headers["Cookie"] = allCookies;
      }
    } catch {
      // Not in a Server Component context, ignore
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Important pour envoyer les cookies côté client
  });

  const duration = getElapsedTime();
  const hasAuth = !!(headers as Record<string, string>)["Cookie"];

  if (!res.ok) {
    logApiCall({ method, url, status: res.status, duration, hasAuth, body, error: res.statusText });
    const { TRPCError } = await import("@trpc/server");
    const codeMap: Record<number, ConstructorParameters<typeof TRPCError>[0]["code"]> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      405: "METHOD_NOT_SUPPORTED",
      408: "TIMEOUT",
      409: "CONFLICT",
      413: "PAYLOAD_TOO_LARGE",
      422: "UNPROCESSABLE_CONTENT",
      429: "TOO_MANY_REQUESTS",
      499: "CLIENT_CLOSED_REQUEST",
    };
    throw new TRPCError({
      code: codeMap[res.status] ?? "INTERNAL_SERVER_ERROR",
      message: `API error: ${res.status} ${res.statusText}`,
    });
  }

  logApiCall({ method, url, status: res.status, duration, hasAuth, body });

  const data = await res.json();
  return data;
}
