import { redis } from "../queue/connection";
import logger from "../logger";

const DEFAULT_TTL = 60; // 1 minute default cache

interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
}

export const cache = {
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error("Cache get error", { key, error });
      return null;
    }
  },

  /**
   * Set cached value with TTL
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl ?? DEFAULT_TTL;
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error("Cache set error", { key, ttl, error });
    }
  },

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error("Cache delete error", { key, error });
    }
  },

  /**
   * Delete keys matching pattern (SCAN-based, non-blocking)
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys: string[] = [];
      const stream = redis.scanStream({ match: pattern, count: 100 });

      await new Promise<void>((resolve, reject) => {
        stream.on("data", (batch: string[]) => {
          for (const key of batch) {
            keys.push(key);
          }
        });
        stream.on("end", resolve);
        stream.on("error", reject);
      });

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error("Cache delete pattern error", { pattern, error });
    }
  },

  /**
   * Generate cache key
   */
  generateKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(":")}`;
  },

  /**
   * Wrap function with cache
   * If cache hit, return cached value
   * Otherwise, execute function and cache result
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, options);
    return result;
  },
};

export const CACHE_KEYS = {
  stats: {
    global: (projectId?: string) => cache.generateKey("stats:global", projectId || "all"),
    dashboard: (projectId?: string) => cache.generateKey("stats:dashboard", projectId || "all"),
    timeline: (range: string, projectId?: string) => 
      cache.generateKey("stats:timeline", range, projectId || "all"),
    envBreakdown: (projectId?: string) => 
      cache.generateKey("stats:env", projectId || "all"),
  },
  groups: {
    list: (projectId: string, filters: string) => 
      cache.generateKey("groups:list", projectId, filters),
    byFingerprint: (fingerprint: string) => 
      cache.generateKey("groups:fingerprint", fingerprint),
  },
} as const;

export const CACHE_TTL = {
  STATS_GLOBAL: 60,
  STATS_DASHBOARD: 30,
  STATS_TIMELINE: 60 * 5,
  STATS_ENV_BREAKDOWN: 60 * 5,
  GROUPS_LIST: 15,
  GROUPS_DETAIL: 60,
} as const;
