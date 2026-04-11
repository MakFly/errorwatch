/**
 * Attention Score API
 * Calculates composite scores for error prioritization
 * Based on: severity (40%), frequency (35%), user impact (20%), freshness (5%)
 */

import { getAll, type GroupsResponse } from './groups';
import type { ErrorGroup } from './types';

// Severity value mapping (0-10 scale)
const SEVERITY_MAP: Record<string, number> = {
  fatal: 10,
  error: 7,
  warning: 4,
  info: 2,
  debug: 1,
};

// Weight constants (total = 100%)
const SEVERITY_WEIGHT = 0.40;   // 40%
const FREQUENCY_WEIGHT = 0.35;  // 35%
const IMPACT_WEIGHT = 0.20;     // 20%
const FRESHNESS_WEIGHT = 0.05;  // 5%

// Limits for normalization
const MAX_EVENT_COUNT = 10000;
const MAX_USERS_AFFECTED = 1000;
const FRESHNESS_WINDOW_HOURS = 48;

export interface ScoreBreakdown {
  severity: number;    // Contribution sévérité (0-40)
  frequency: number;   // Contribution fréquence (0-35)
  impact: number;      // Contribution impact (0-20)
  freshness: number;   // Contribution fraîcheur (0-5)
}

export interface AttentionItem extends ErrorGroup {
  attentionScore: number;
  scoreBreakdown: ScoreBreakdown;
}

/**
 * Calculate attention score for an error group
 * Returns score (0-100) and breakdown by component
 */
function calculateAttentionScore(group: ErrorGroup): { score: number; breakdown: ScoreBreakdown } {
  // 1. Sévérité (0-10 scale, normalized to 0-1)
  const severityRaw = SEVERITY_MAP[group.level ?? "error"] ?? 1;
  const severityScore = severityRaw / 10;

  // 2. Fréquence (log scale, capped at MAX_EVENT_COUNT)
  const count = Math.min(group.count ?? 0, MAX_EVENT_COUNT);
  const frequencyScore = Math.log10(count + 1) / 4; // log10(10001) ≈ 4

  // 3. Impact utilisateur (log scale, capped at MAX_USERS_AFFECTED)
  // Note: usersAffected not available in current schema, defaulting to 0
  const users = Math.min((group as any).usersAffected ?? 0, MAX_USERS_AFFECTED);
  const impactScore = Math.log10(users + 1) / 3; // log10(1001) ≈ 3

  // 4. Fraîcheur (linear decay over FRESHNESS_WINDOW_HOURS)
  // 0h → 1.0, 24h → 0.5, 48h → 0.0
  const lastSeenDate = group.lastSeen ? new Date(group.lastSeen) : new Date(0);
  const hoursAgo = (Date.now() - lastSeenDate.getTime()) / 3600000;
  const freshnessScore = Math.max(0, 1 - hoursAgo / FRESHNESS_WINDOW_HOURS);

  // Calculate weighted contributions
  const breakdown: ScoreBreakdown = {
    severity: Math.round(SEVERITY_WEIGHT * severityScore * 100 * 10) / 10,
    frequency: Math.round(FREQUENCY_WEIGHT * frequencyScore * 100 * 10) / 10,
    impact: Math.round(IMPACT_WEIGHT * impactScore * 100 * 10) / 10,
    freshness: Math.round(FRESHNESS_WEIGHT * freshnessScore * 100 * 10) / 10,
  };

  // Final score (0-100 scale)
  const score = Math.round(
    breakdown.severity +
    breakdown.frequency +
    breakdown.impact +
    breakdown.freshness
  );

  return { score, breakdown };
}

/**
 * Get top attention items for a project
 * Fetches all issues, filters non-actionable levels (info, debug)
 * Sorted by attention score descending
 */
export async function getTop(
  projectId: string | undefined,
  limit: number = 8
): Promise<AttentionItem[]> {
  // Validate limit
  const validLimit = Math.max(1, Math.min(20, limit));

  // Fetch all error groups
  const response: GroupsResponse = await getAll({
    projectId,
    limit: 100, // Fetch more to score and filter
  });

  const groups = response.groups;

  if (!groups || groups.length === 0) {
    return [];
  }

  // Filter out non-actionable levels (info, debug)
  const activeGroups = groups.filter((group) => {
    if (group.level === "info" || group.level === "debug") return false;
    return true;
  });

  // Calculate scores for each group
  const withScores: AttentionItem[] = activeGroups.map((group) => {
    const { score, breakdown } = calculateAttentionScore(group);
    return {
      ...group,
      attentionScore: score,
      scoreBreakdown: breakdown,
    };
  });

  // Sort by score descending and limit
  return withScores
    .sort((a, b) => b.attentionScore - a.attentionScore)
    .slice(0, validLimit);
}

export const attentionApi = {
  getTop,
};
