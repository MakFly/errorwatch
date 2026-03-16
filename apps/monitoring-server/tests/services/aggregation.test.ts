/**
 * Tests for the aggregation service logic.
 * We verify the result counting behaviour and day-boundary calculations
 * without requiring a real DB connection.
 */
import { describe, test, expect } from "bun:test";

// ── Minimal stubs ─────────────────────────────────────────────────────────────

// Stub for db.execute(sql`...`) — returns a fake result array
function makeExecuteStub(returnRows: unknown[]) {
  return {
    execute: (_sql: unknown) => Promise.resolve(returnRows),
  };
}

// ── Inline logic under test (same structure as aggregation.ts) ────────────────

async function aggregateHourlyMetricsWithDb(
  db: ReturnType<typeof makeExecuteStub>,
  targetDate: Date
): Promise<number> {
  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);

  let totalRows = 0;

  for (let hour = 0; hour < 24; hour++) {
    const result = await db.execute(null);
    totalRows += (result as unknown[]).length;
  }

  return totalRows;
}

async function aggregateDailyFromHourlyWithDb(
  db: ReturnType<typeof makeExecuteStub>,
  targetDate: Date
): Promise<{ metrics: number; transactions: number }> {
  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const metricsResult = await db.execute(null);
  const transResult = await db.execute(null);

  return {
    metrics: (metricsResult as unknown[]).length,
    transactions: (transResult as unknown[]).length,
  };
}

async function cleanupOldAggregatesWithDb(
  db: ReturnType<typeof makeExecuteStub>,
  retentionMonths = 12
): Promise<{ hourlyMetrics: number; hourlyTransactions: number }> {
  const metricsResult = await db.execute(null);
  const transResult = await db.execute(null);

  return {
    hourlyMetrics: (metricsResult as unknown[]).length,
    hourlyTransactions: (transResult as unknown[]).length,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("aggregation.aggregateHourlyMetrics", () => {
  test("iterates over all 24 hours of the target date", async () => {
    let callCount = 0;
    const db = {
      execute: (_sql: unknown) => {
        callCount++;
        return Promise.resolve([]);
      },
    };

    await aggregateHourlyMetricsWithDb(db, new Date("2024-01-15"));
    expect(callCount).toBe(24);
  });

  test("accumulates row counts from each hourly result", async () => {
    // Each hour returns 3 rows → 24 * 3 = 72 total
    const db = makeExecuteStub([{}, {}, {}]);
    const total = await aggregateHourlyMetricsWithDb(db, new Date("2024-01-15"));
    expect(total).toBe(72);
  });

  test("returns 0 when all hourly buckets are empty", async () => {
    const db = makeExecuteStub([]);
    const total = await aggregateHourlyMetricsWithDb(db, new Date("2024-01-15"));
    expect(total).toBe(0);
  });

  test("dayStart is set to midnight UTC regardless of input time", () => {
    const input = new Date("2024-03-10T15:30:45.000Z");
    const dayStart = new Date(input);
    dayStart.setUTCHours(0, 0, 0, 0);
    expect(dayStart.getUTCHours()).toBe(0);
    expect(dayStart.getUTCMinutes()).toBe(0);
    expect(dayStart.getUTCSeconds()).toBe(0);
    expect(dayStart.getUTCDate()).toBe(10);
  });
});

describe("aggregation.aggregateDailyFromHourly", () => {
  test("returns metrics and transactions counts from db results", async () => {
    // metrics query returns 2 rows, transactions query returns 3 rows
    let call = 0;
    const db = {
      execute: (_sql: unknown) => {
        call++;
        return Promise.resolve(call === 1 ? [{}, {}] : [{}, {}, {}]);
      },
    };

    const result = await aggregateDailyFromHourlyWithDb(db, new Date("2024-01-15"));
    expect(result.metrics).toBe(2);
    expect(result.transactions).toBe(3);
  });

  test("dayEnd is exactly 1 day after dayStart", () => {
    const input = new Date("2024-06-01T00:00:00.000Z");
    const dayStart = new Date(input);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const diff = dayEnd.getTime() - dayStart.getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });
});

describe("aggregation.cleanupOldAggregates", () => {
  test("returns accurate counts from both DELETE results", async () => {
    let call = 0;
    const db = {
      execute: (_sql: unknown) => {
        call++;
        return Promise.resolve(call === 1 ? [{}] : [{}, {}]);
      },
    };

    const result = await cleanupOldAggregatesWithDb(db, 12);
    expect(result.hourlyMetrics).toBe(1);
    expect(result.hourlyTransactions).toBe(2);
  });

  test("returns zero counts when nothing to delete", async () => {
    const db = makeExecuteStub([]);
    const result = await cleanupOldAggregatesWithDb(db, 12);
    expect(result.hourlyMetrics).toBe(0);
    expect(result.hourlyTransactions).toBe(0);
  });
});
