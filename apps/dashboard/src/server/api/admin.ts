/**
 * Admin API client - server-side only
 * Uses ADMIN_API_KEY (never exposed to the browser)
 */

import { API_URL } from "./client";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!ADMIN_API_KEY) {
    throw new Error("ADMIN_API_KEY is not configured on the server");
  }

  const res = await fetch(`${API_URL}/api/v1/admin${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_API_KEY}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export type CronStatus = {
  scheduledJobs: {
    key: string;
    name: string;
    pattern: string;
    next: string | null;
  }[];
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  recentHistory: {
    id: string;
    name: string;
    data: Record<string, unknown>;
    finishedOn: string | null;
    returnvalue: unknown;
    duration: number | null;
  }[];
};

export type FailedJob = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  failedReason: string;
  attemptsMade: number;
  timestamp: string | null;
  finishedOn: string | null;
  stacktrace: string[];
};

export function getCronStatus(): Promise<CronStatus> {
  return adminFetch<CronStatus>("/cron/status");
}

export function getFailedJobs(): Promise<FailedJob[]> {
  return adminFetch<FailedJob[]>("/cron/failed");
}

export function runJobSync(type: string, targetDate: string): Promise<unknown> {
  return adminFetch<unknown>("/cron/run-sync", {
    method: "POST",
    body: JSON.stringify({ type, targetDate }),
  });
}

export function clearFailedJobs(): Promise<void> {
  return adminFetch<void>("/cron/failed", { method: "DELETE" });
}

export function isConfigured(): boolean {
  return !!ADMIN_API_KEY;
}
