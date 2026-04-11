import { fetchAPI } from './client';
import type {
  WebVitalSummary,
  TransactionsResponse,
  TransactionWithSpans,
  SlowestTransaction,
  SpanAnalysis,
  ApdexScore,
  ServerStats,
  EndpointImpact,
  ThroughputBucket,
  DurationBucket,
  PerformanceDateRange,
} from './types';

export const getWebVitals = async (
  projectId: string,
  dateRange?: PerformanceDateRange
): Promise<WebVitalSummary[]> => {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (dateRange) params.set("dateRange", dateRange);
  return fetchAPI<WebVitalSummary[]>(`/performance/web-vitals?${params.toString()}`);
};

export const getTransactions = async (
  projectId: string,
  options?: { op?: string; page?: number; limit?: number; dateRange?: PerformanceDateRange }
): Promise<TransactionsResponse> => {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (options?.op) params.set("op", options.op);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.dateRange) params.set("dateRange", options.dateRange);
  return fetchAPI<TransactionsResponse>(`/performance/transactions?${params.toString()}`);
};

export const getTransaction = async (
  transactionId: string
): Promise<TransactionWithSpans> => {
  return fetchAPI<TransactionWithSpans>(`/performance/transactions/${transactionId}`);
};

export const getSlowest = async (
  projectId: string,
  dateRange?: PerformanceDateRange
): Promise<SlowestTransaction[]> => {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (dateRange) params.set("dateRange", dateRange);
  return fetchAPI<SlowestTransaction[]>(`/performance/slowest?${params.toString()}`);
};

export const getSpanAnalysis = async (
  projectId: string,
  dateRange?: PerformanceDateRange
): Promise<SpanAnalysis> => {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (dateRange) params.set("dateRange", dateRange);
  return fetchAPI<SpanAnalysis>(`/performance/span-analysis?${params.toString()}`);
};

export const getApdex = async (
  projectId: string,
  dateRange?: PerformanceDateRange
): Promise<ApdexScore> => {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (dateRange) params.set("dateRange", dateRange);
  return fetchAPI<ApdexScore>(`/performance/apdex?${params.toString()}`);
};

export const getServerStats = async (
  projectId: string,
  dateRange?: PerformanceDateRange
): Promise<ServerStats> => {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (dateRange) params.set("dateRange", dateRange);
  return fetchAPI<ServerStats>(`/performance/server-stats?${params.toString()}`);
};

export const getTopEndpoints = async (
  projectId: string,
  dateRange?: PerformanceDateRange
): Promise<EndpointImpact[]> => {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (dateRange) params.set("dateRange", dateRange);
  return fetchAPI<EndpointImpact[]>(`/performance/top-endpoints?${params.toString()}`);
};

export const getThroughputTimeline = async (
  projectId: string,
  dateRange?: PerformanceDateRange,
  name?: string
): Promise<ThroughputBucket[]> => {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (dateRange) params.set("dateRange", dateRange);
  if (name) params.set("name", name);
  return fetchAPI<ThroughputBucket[]>(`/performance/throughput-timeline?${params.toString()}`);
};

export const getDurationTimeline = async (
  projectId: string,
  dateRange?: PerformanceDateRange,
  name?: string
): Promise<DurationBucket[]> => {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (dateRange) params.set("dateRange", dateRange);
  if (name) params.set("name", name);
  return fetchAPI<DurationBucket[]>(`/performance/duration-timeline?${params.toString()}`);
};
