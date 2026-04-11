import { fetchAPI } from './client';
import type { ErrorGroup, EventsResponse, IssueStatus, ReleaseDistribution, GroupsFilter } from './types';

export type GroupsResponse = {
  groups: ErrorGroup[];
  total: number;
  page: number;
  totalPages: number;
};

export const getAll = async (filters?: GroupsFilter): Promise<GroupsResponse> => {
  const params = new URLSearchParams();
  if (filters?.env) params.set("env", filters.env);
  if (filters?.dateRange) params.set("dateRange", filters.dateRange);
  if (filters?.projectId) params.set("projectId", filters.projectId);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.level) params.set("level", filters.level);
  if (filters?.levels && filters.levels.length > 0) params.set("levels", filters.levels.join(","));
  if (filters?.sort) params.set("sort", filters.sort);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return fetchAPI<GroupsResponse>(`/groups${query ? `?${query}` : ""}`);
};

export const getById = async (fingerprint: string): Promise<ErrorGroup | null> => {
  return fetchAPI<ErrorGroup | null>(`/groups/${fingerprint}`);
};

export const getEvents = async (fingerprint: string, page: number = 1, limit: number = 10): Promise<EventsResponse> => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  return fetchAPI<EventsResponse>(`/groups/${fingerprint}/events?${params.toString()}`);
};

export const getTimeline = async (fingerprint: string): Promise<Array<{ date: string; count: number }>> => {
  return fetchAPI<Array<{ date: string; count: number }>>(`/groups/${fingerprint}/timeline`);
};

export const updateStatus = async (fingerprint: string, status: IssueStatus): Promise<ErrorGroup> => {
  return fetchAPI<ErrorGroup>(`/groups/${fingerprint}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
};

export const updateAssignment = async (fingerprint: string, assignedTo: string | null): Promise<ErrorGroup> => {
  return fetchAPI<ErrorGroup>(`/groups/${fingerprint}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ assignedTo }),
  });
};

export const getReleases = async (fingerprint: string): Promise<ReleaseDistribution> => {
  return fetchAPI<ReleaseDistribution>(`/groups/${fingerprint}/releases`);
};

export const batchUpdateStatus = async (fingerprints: string[], status: IssueStatus): Promise<{ updated: number }> => {
  return fetchAPI<{ updated: number }>(`/groups/batch/status`, {
    method: "PATCH",
    body: JSON.stringify({ fingerprints, status }),
  });
};

export const merge = async (parentFingerprint: string, childFingerprints: string[]): Promise<{ merged: number }> => {
  return fetchAPI<{ merged: number }>(`/groups/${parentFingerprint}/merge`, {
    method: "POST",
    body: JSON.stringify({ fingerprints: childFingerprints }),
  });
};

export const unmerge = async (fingerprint: string): Promise<{ success: boolean }> => {
  return fetchAPI<{ success: boolean }>(`/groups/${fingerprint}/unmerge`, {
    method: "POST",
  });
};

export const snooze = async (fingerprint: string, until: string): Promise<ErrorGroup> => {
  return fetchAPI<ErrorGroup>(`/groups/${fingerprint}/snooze`, {
    method: "PATCH",
    body: JSON.stringify({ until }),
  });
};
