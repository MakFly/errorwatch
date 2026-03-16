import { createHmac, randomBytes } from "crypto";
import { eq, and, or } from "drizzle-orm";
import { db } from "../db/connection";
import { apiKeys, projects, organizationMembers } from "../db/schema";

const API_KEY_HASH_SECRET = process.env.API_KEY_HASH_SECRET;
if (!API_KEY_HASH_SECRET) {
  throw new Error("Missing required environment variable: API_KEY_HASH_SECRET");
}
export const API_KEY_PATTERN = /^ew_(live|test)_[A-Za-z0-9_-]{32,}$/;

interface CachedKey {
  id: string;
  projectId: string;
  expiresAt: number;
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const keyCache = new Map<string, CachedKey>();

function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of keyCache.entries()) {
    if (entry.expiresAt < now) {
      keyCache.delete(key);
    }
  }
}

setInterval(cleanupCache, 60 * 1000);

export function isApiKeyFormat(apiKey: string): boolean {
  return API_KEY_PATTERN.test(apiKey);
}

export function hashApiKey(apiKey: string): string {
  return createHmac("sha256", API_KEY_HASH_SECRET).update(apiKey).digest("hex");
}

function getCacheKey(apiKeyOrHash: string): string {
  return isApiKeyFormat(apiKeyOrHash) ? hashApiKey(apiKeyOrHash) : apiKeyOrHash;
}

export function getCachedApiKey(apiKeyOrHash: string): CachedKey | null {
  const cacheKey = getCacheKey(apiKeyOrHash);
  const cached = keyCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    keyCache.delete(cacheKey);
    return null;
  }
  return cached;
}

export function cacheApiKey(apiKeyOrHash: string, data: { id: string; projectId: string }): void {
  const cacheKey = getCacheKey(apiKeyOrHash);
  keyCache.set(cacheKey, {
    ...data,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

export function invalidateCachedApiKey(apiKeyOrHash: string): void {
  const cacheKey = getCacheKey(apiKeyOrHash);
  keyCache.delete(cacheKey);
}

export function getKeyPreviewParts(apiKey: string): { keyPrefix: string; keyLast4: string } {
  return {
    keyPrefix: apiKey.slice(0, 8),
    keyLast4: apiKey.slice(-4),
  };
}

export function getKeyPreview(input: {
  key?: string | null;
  keyPrefix?: string | null;
  keyLast4?: string | null;
}): string | undefined {
  if (input.keyPrefix && input.keyLast4) {
    return `${input.keyPrefix}...${input.keyLast4}`;
  }

  if (input.key && isApiKeyFormat(input.key)) {
    return `${input.key.slice(0, 8)}...${input.key.slice(-4)}`;
  }

  return undefined;
}

export function generateApiKey(type: "live" | "test" = "live"): string {
  const bytes = randomBytes(24).toString("base64url");
  return `ew_${type}_${bytes}`;
}

export async function createApiKey(projectId: string, name: string, userId: string) {
  // Verify user has access to this project
  const project = (await db
    .select({ id: projects.id, organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId)))[0];

  if (!project) {
    throw new Error("Project not found");
  }

  const membership = (await db
    .select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, project.organizationId),
      eq(organizationMembers.userId, userId)
    )))[0];

  if (!membership) {
    throw new Error("Access denied");
  }

  const key = generateApiKey("live");
  const keyHash = hashApiKey(key);
  const { keyPrefix, keyLast4 } = getKeyPreviewParts(key);

  const result = await db
    .insert(apiKeys)
    .values({
      id: crypto.randomUUID(),
      projectId,
      key: keyHash,
      keyPrefix,
      keyLast4,
      name,
      createdAt: new Date(),
    })
    .returning();

  return { ...result[0], key };
}

export async function listApiKeys(projectId: string, userId: string) {
  // Verify user has access to this project
  const project = (await db
    .select({ id: projects.id, organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId)))[0];

  if (!project) {
    throw new Error("Project not found");
  }

  const membership = (await db
    .select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, project.organizationId),
      eq(organizationMembers.userId, userId)
    )))[0];

  if (!membership) {
    throw new Error("Access denied");
  }

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      key: apiKeys.key,
      keyPrefix: apiKeys.keyPrefix,
      keyLast4: apiKeys.keyLast4,
    })
    .from(apiKeys)
    .where(eq(apiKeys.projectId, projectId));

  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    keyPreview: getKeyPreview({
      key: k.key,
      keyPrefix: k.keyPrefix,
      keyLast4: k.keyLast4,
    }),
  }));
}

export async function deleteApiKey(keyId: string, userId: string) {
  const key = (await db
    .select({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      key: apiKeys.key,
    })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId)))[0];

  if (!key) {
    throw new Error("API key not found");
  }

  // Verify user has access to this project
  const project = (await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, key.projectId)))[0];

  if (!project) {
    throw new Error("Project not found");
  }

  const membership = (await db
    .select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, project.organizationId),
      eq(organizationMembers.userId, userId)
    )))[0];

  if (!membership) {
    throw new Error("Access denied");
  }

  await db.delete(apiKeys).where(eq(apiKeys.id, keyId));

  // Invalidate cache so deleted key can't be used during TTL window
  invalidateCachedApiKey(key.key);

  return { success: true };
}

export async function validateApiKey(key: string) {
  const keyHash = hashApiKey(key);
  const apiKey = (await db
    .select({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      key: apiKeys.key,
      keyPrefix: apiKeys.keyPrefix,
      keyLast4: apiKeys.keyLast4,
    })
    .from(apiKeys)
    .where(or(eq(apiKeys.key, keyHash), eq(apiKeys.key, key))))[0];

  if (!apiKey) {
    return null;
  }

  const updates: Partial<{
    key: string;
    keyPrefix: string;
    keyLast4: string;
    lastUsedAt: Date;
  }> = {
    lastUsedAt: new Date(),
  };

  if (apiKey.key && isApiKeyFormat(apiKey.key)) {
    const { keyPrefix, keyLast4 } = getKeyPreviewParts(key);
    updates.key = keyHash;
    updates.keyPrefix = keyPrefix;
    updates.keyLast4 = keyLast4;
  } else if (!apiKey.keyPrefix || !apiKey.keyLast4) {
    const { keyPrefix, keyLast4 } = getKeyPreviewParts(key);
    updates.keyPrefix = apiKey.keyPrefix ?? keyPrefix;
    updates.keyLast4 = apiKey.keyLast4 ?? keyLast4;
  }

  await db.update(apiKeys).set(updates).where(eq(apiKeys.id, apiKey.id));

  return apiKey;
}
