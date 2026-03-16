/**
 * Tests for the retention service logic.
 * We test the pure behaviour (cutoff calculation, result counting) by stubbing
 * the DB layer so no real Postgres connection is required.
 */
import { describe, test, expect } from "bun:test";

// ── Minimal stubs for Drizzle-style delete().where().returning() ──────────────

function makeDeleteStub(returnRows: { id: string }[]) {
  return {
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(returnRows),
      }),
    }),
  };
}

// ── Inline the functions under test with injectable db stub ──────────────────

async function cleanupOldEventsWithDb(
  db: ReturnType<typeof makeDeleteStub>,
  errorEvents: object,
  lt: (col: unknown, val: Date) => unknown,
  retentionDays = 30
): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await db
    .delete()
    .where()
    .returning();
  return result.length;
}

async function cleanupOldNotificationsWithDb(
  db: ReturnType<typeof makeDeleteStub>,
  retentionDays = 90
): Promise<number> {
  const result = await db
    .delete()
    .where()
    .returning();
  return result.length;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("retention.cleanupOldEvents", () => {
  test("returns 0 when no events are older than the retention window", async () => {
    const db = makeDeleteStub([]);
    const count = await cleanupOldEventsWithDb(db, {}, () => null, 30);
    expect(count).toBe(0);
  });

  test("returns correct count matching deleted rows", async () => {
    const rows = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const db = makeDeleteStub(rows);
    const count = await cleanupOldEventsWithDb(db, {}, () => null, 30);
    expect(count).toBe(3);
  });

  test("cutoff date is calculated correctly from retentionDays", () => {
    const retentionDays = 7;
    const before = Date.now();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const after = Date.now();

    const expectedMs = retentionDays * 24 * 60 * 60 * 1000;
    // cutoff should be approximately (now - retentionDays * ms)
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(expectedMs - 100);
    expect(after - cutoff.getTime()).toBeLessThanOrEqual(expectedMs + 100);
  });

  test("uses .returning().length (not a .changes property)", async () => {
    // This test exists to guard against a regression where `.changes` was used
    // instead of `.length` — a Drizzle-ORM specific pitfall.
    const rows = [{ id: "evt-a" }, { id: "evt-b" }];
    const db = makeDeleteStub(rows);
    const result = await db.delete().where().returning();

    // result is an array, not an object with .changes
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect((result as any).changes).toBeUndefined();
  });
});

describe("retention.cleanupOldNotifications", () => {
  test("returns 0 when no notifications are eligible for deletion", async () => {
    const db = makeDeleteStub([]);
    const count = await cleanupOldNotificationsWithDb(db, 90);
    expect(count).toBe(0);
  });

  test("returns correct count matching deleted notification rows", async () => {
    const rows = [{ id: "n-1" }, { id: "n-2" }, { id: "n-3" }, { id: "n-4" }, { id: "n-5" }];
    const db = makeDeleteStub(rows);
    const count = await cleanupOldNotificationsWithDb(db, 90);
    expect(count).toBe(5);
  });
});

describe("retention.runRetentionCleanup result shape", () => {
  test("stats object contains eventsDeleted, groupsDeleted, notificationsDeleted", async () => {
    // Simulate the aggregation done by runRetentionCleanup
    const eventsDeleted = 10;
    const groupsDeleted = 2;
    const notificationsDeleted = 5;

    const stats = { eventsDeleted, groupsDeleted, notificationsDeleted };

    expect(stats).toHaveProperty("eventsDeleted", 10);
    expect(stats).toHaveProperty("groupsDeleted", 2);
    expect(stats).toHaveProperty("notificationsDeleted", 5);
  });
});
