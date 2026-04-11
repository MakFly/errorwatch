import { eq, gt, desc, inArray, and, sql, ilike, or, lt } from "drizzle-orm";
import { db } from "../db/connection";
import { errorGroups, errorEvents } from "../db/schema";

export interface CursorPaginationParams {
  cursor?: string; // Base64 encoded cursor (lastSeen timestamp + fingerprint)
  limit?: number;
  dateRange?: string;
  env?: string;
  search?: string;
  level?: string;
  sort?: "lastSeen" | "firstSeen" | "count";
}

function parseDateRange(dateRange?: string): Date {
  const now = Date.now();
  if (!dateRange || dateRange === "all") return new Date(0);
  
  const hours = dateRange === "24h" ? 24
    : dateRange === "7d" ? 24 * 7
    : dateRange === "30d" ? 24 * 30
    : 24 * 90;
  
  return new Date(now - hours * 60 * 60 * 1000);
}

function encodeCursor(lastSeen: Date, fingerprint: string): string {
  return Buffer.from(`${lastSeen.toISOString()}|${fingerprint}`).toString("base64");
}

function decodeCursor(cursor: string): { lastSeen: Date; fingerprint: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const [lastSeenStr, fingerprint] = decoded.split("|");
    return { lastSeen: new Date(lastSeenStr), fingerprint };
  } catch {
    return null;
  }
}

export const GroupRepository = {
  /**
   * Optimized findAll using single query with LEFT JOIN for replay data
   * Replaces 3 separate queries (groups + replayCounts + latestReplays) with 1
   */
  findAll: async (filters?: { dateRange?: string; env?: string; search?: string; level?: string; levels?: string[]; sort?: string; page?: number; limit?: number }, projectId?: string) => {
    const startDate = parseDateRange(filters?.dateRange);
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions: any[] = [];

    if (projectId) {
      conditions.push(eq(errorGroups.projectId, projectId));
    }

    conditions.push(gt(errorGroups.lastSeen, startDate));
    conditions.push(sql`${errorGroups.mergedInto} IS NULL`);

    if (filters?.search) {
      conditions.push(
        or(
          ilike(errorGroups.message, `%${filters.search}%`),
          ilike(errorGroups.file, `%${filters.search}%`)
        )
      );
    }

    if (filters?.levels && filters.levels.length > 0) {
      conditions.push(inArray(errorGroups.level, filters.levels));
    } else if (filters?.level && filters.level !== "all") {
      conditions.push(eq(errorGroups.level, filters.level));
    }

    // Environment filter - use subquery with EXISTS instead of IN for better performance
    if (filters?.env && filters.env !== "all") {
      const envSubquery = db
        .select({ fingerprint: errorEvents.fingerprint })
        .from(errorEvents)
        .where(
          and(
            eq(errorEvents.env, filters.env),
            projectId ? eq(errorEvents.projectId, projectId) : undefined
          )
        )
        .groupBy(errorEvents.fingerprint)
        .as("env_events");
      
      conditions.push(sql`${errorGroups.fingerprint} IN (SELECT fingerprint FROM ${envSubquery})`);
    }

    const whereClause = and(...conditions);

    // Sort
    const sortColumn = filters?.sort === "firstSeen" ? errorGroups.firstSeen
      : filters?.sort === "count" ? errorGroups.count
      : errorGroups.lastSeen;
    const orderBy = desc(sortColumn);

    // Optimized: Single query with replay data using window functions
    // This replaces 3 separate queries (lines 102-169 in original)
    const groupsWithReplay = await db.execute(sql`
      SELECT 
        error_groups.*,
        replay_data.has_replay,
        replay_data.latest_session_id,
        replay_data.latest_event_id,
        replay_data.latest_created_at
      FROM error_groups
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(e.id) > 0 as has_replay,
          MAX(e.session_id) FILTER (WHERE e.session_id IS NOT NULL) as latest_session_id,
          MAX(e.id) FILTER (WHERE e.session_id IS NOT NULL) as latest_event_id,
          MAX(e.created_at) FILTER (WHERE e.session_id IS NOT NULL) as latest_created_at
        FROM error_events e
        WHERE e.fingerprint = error_groups.fingerprint AND e.session_id IS NOT NULL
      ) replay_data ON true
      WHERE ${whereClause}
      ORDER BY ${sortColumn} DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count (separate query needed for pagination info)
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(errorGroups)
      .where(whereClause);
    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Transform results - db.execute returns rows property
    // @ts-expect-error - Drizzle execute return type compatibility
    const groupsRaw = groupsWithReplay.rows ? groupsWithReplay.rows : groupsWithReplay;
    const groups = (Array.isArray(groupsRaw) ? groupsRaw : []).map((row: any) => ({
      fingerprint: row.fingerprint,
      projectId: row.project_id,
      message: row.message,
      file: row.file,
      line: row.line,
      statusCode: row.status_code,
      level: row.level,
      count: row.count,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      assignedTo: row.assigned_to,
      assignedAt: row.assigned_at,
      mergedInto: row.merged_into,
      exceptionType: row.exception_type,
      exceptionValue: row.exception_value,
      hasReplay: row.has_replay,
      latestReplaySessionId: row.latest_session_id,
      latestReplayEventId: row.latest_event_id,
      latestReplayCreatedAt: row.latest_created_at,
    }));

    return { groups, total, page, totalPages };
  },

  /**
   * Cursor-based pagination for better performance on large datasets
   * Use this instead of offset-based for datasets > 10k rows
   */
  findAllCursor: async (filters?: CursorPaginationParams, projectId?: string) => {
    const startDate = parseDateRange(filters?.dateRange);
    const limit = (filters?.limit || 50) + 1; // Fetch one extra to determine if there's a next page

    const conditions: any[] = [];

    if (projectId) {
      conditions.push(eq(errorGroups.projectId, projectId));
    }

    conditions.push(gt(errorGroups.lastSeen, startDate));
    conditions.push(sql`${errorGroups.mergedInto} IS NULL`);

    // Apply cursor filter (exclusive - start after cursor)
    const cursor = filters?.cursor ? decodeCursor(filters?.cursor) : null;
    if (cursor) {
      conditions.push(
        or(
          lt(errorGroups.lastSeen, cursor.lastSeen),
          and(
            eq(errorGroups.lastSeen, cursor.lastSeen),
            lt(errorGroups.fingerprint, cursor.fingerprint)
          )
        )
      );
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(errorGroups.message, `%${filters.search}%`),
          ilike(errorGroups.file, `%${filters.search}%`)
        )
      );
    }

    if (filters?.level && filters.level !== "all") {
      conditions.push(eq(errorGroups.level, filters.level));
    }

    if (filters?.env && filters.env !== "all") {
      const envSubquery = db
        .select({ fingerprint: errorEvents.fingerprint })
        .from(errorEvents)
        .where(
          and(
            eq(errorEvents.env, filters.env),
            projectId ? eq(errorEvents.projectId, projectId) : undefined
          )
        )
        .groupBy(errorEvents.fingerprint)
        .as("env_events");
      
      conditions.push(sql`${errorGroups.fingerprint} IN (SELECT fingerprint FROM ${envSubquery})`);
    }

    const whereClause = and(...conditions);

    // Sort
    const sortColumn = filters?.sort === "firstSeen" ? errorGroups.firstSeen
      : filters?.sort === "count" ? errorGroups.count
      : errorGroups.lastSeen;
    const orderBy = desc(sortColumn);

    // Single optimized query with replay data
    const groupsWithReplay = await db.execute(sql`
      SELECT 
        error_groups.*,
        replay_data.has_replay,
        replay_data.latest_session_id,
        replay_data.latest_event_id,
        replay_data.latest_created_at
      FROM error_groups
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(e.id) > 0 as has_replay,
          MAX(e.session_id) FILTER (WHERE e.session_id IS NOT NULL) as latest_session_id,
          MAX(e.id) FILTER (WHERE e.session_id IS NOT NULL) as latest_event_id,
          MAX(e.created_at) FILTER (WHERE e.session_id IS NOT NULL) as latest_created_at
        FROM error_events e
        WHERE e.fingerprint = error_groups.fingerprint AND e.session_id IS NOT NULL
      ) replay_data ON true
      WHERE ${whereClause}
      ORDER BY ${sortColumn} DESC, error_groups.fingerprint DESC
      LIMIT ${limit}
    `);

    // @ts-expect-error - Drizzle execute return type compatibility
    const rowsRaw = groupsWithReplay.rows ? groupsWithReplay.rows : groupsWithReplay;
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
    const hasMore = rows.length > (filters?.limit || 50);
    const groups = rows.slice(0, filters?.limit || 50).map((row: any) => ({
      fingerprint: row.fingerprint,
      projectId: row.project_id,
      message: row.message,
      file: row.file,
      line: row.line,
      statusCode: row.status_code,
      level: row.level,
      count: row.count,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      assignedTo: row.assigned_to,
      assignedAt: row.assigned_at,
      mergedInto: row.merged_into,
      exceptionType: row.exception_type,
      exceptionValue: row.exception_value,
      hasReplay: row.has_replay,
      latestReplaySessionId: row.latest_session_id,
      latestReplayEventId: row.latest_event_id,
      latestReplayCreatedAt: row.latest_created_at,
    }));

    // Generate next cursor
    const nextCursor = hasMore && groups.length > 0
      ? encodeCursor(groups[groups.length - 1].lastSeen, groups[groups.length - 1].fingerprint)
      : null;

    return { groups, nextCursor, hasMore };
  },

  findByFingerprint: (fingerprint: string) =>
    db.select().from(errorGroups).where(eq(errorGroups.fingerprint, fingerprint)).then(rows => rows[0]),

  updateAssignment: (fingerprint: string, assignedTo: string | null) =>
    db
      .update(errorGroups)
      .set({
        assignedTo,
        assignedAt: assignedTo ? new Date() : null,
      })
      .where(eq(errorGroups.fingerprint, fingerprint))
      .returning(),

  merge: async (parentFingerprint: string, childFingerprints: string[]) => {
    // Set mergedInto on children
    await db
      .update(errorGroups)
      .set({ mergedInto: parentFingerprint })
      .where(inArray(errorGroups.fingerprint, childFingerprints));

    // Sum up child counts into parent
    const children = await db
      .select({ count: errorGroups.count })
      .from(errorGroups)
      .where(inArray(errorGroups.fingerprint, childFingerprints));

    const totalChildCount = children.reduce((sum, c) => sum + c.count, 0);

    await db
      .update(errorGroups)
      .set({ count: sql`${errorGroups.count} + ${totalChildCount}` })
      .where(eq(errorGroups.fingerprint, parentFingerprint));

    return childFingerprints.length;
  },

  unmerge: async (fingerprint: string) => {
    await db
      .update(errorGroups)
      .set({ mergedInto: null })
      .where(eq(errorGroups.fingerprint, fingerprint));
  },

  getMergedChildren: async (fingerprint: string) => {
    return db
      .select()
      .from(errorGroups)
      .where(eq(errorGroups.mergedInto, fingerprint));
  },

  getReleaseDistribution: async (fingerprint: string) => {
    const releases = await db
      .select({
        release: errorEvents.release,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(errorEvents)
      .where(eq(errorEvents.fingerprint, fingerprint))
      .groupBy(errorEvents.release)
      .orderBy(desc(sql`count(*)`));

    // Get total count for percentage calculation
    const total = releases.reduce((sum, r) => sum + r.count, 0);

    // Get the first event to determine "first seen in" release
    const firstEvent = await db
      .select({ release: errorEvents.release })
      .from(errorEvents)
      .where(eq(errorEvents.fingerprint, fingerprint))
      .orderBy(errorEvents.createdAt)
      .limit(1);

    // Filter out events with no release version
    const withVersion = releases.filter((r) => r.release && r.release.trim() !== "");
    const versionedTotal = withVersion.reduce((sum, r) => sum + r.count, 0);

    return {
      releases: withVersion.map((r) => ({
        version: r.release!,
        count: r.count,
        percentage: versionedTotal > 0 ? Math.round((r.count / versionedTotal) * 100) : 0,
      })),
      firstSeenIn: firstEvent[0]?.release || null,
    };
  },
};
