/**
 * Aggregation Service
 * @description Aggregates raw performance data into hourly/daily buckets
 * for long-term retention and fast historical queries.
 */
import { sql } from "drizzle-orm";
import { db } from "../db/connection";
import {
  performanceMetrics,
  performanceMetricsHourly,
  performanceMetricsDaily,
  transactions,
  transactionAggregatesHourly,
  transactionAggregatesDaily,
} from "../db/schema";
import logger from "../logger";

// Apdex thresholds (ms)
const APDEX_SATISFIED = 500;
const APDEX_TOLERATING = 2000;

/**
 * Aggregate performance metrics into hourly buckets for a given date.
 * Processes each hour of the day (0-23).
 * Uses PERCENTILE_CONT for exact percentile computation.
 * Idempotent via ON CONFLICT DO UPDATE.
 */
export async function aggregateHourlyMetrics(targetDate: Date): Promise<number> {
  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);

  let totalRows = 0;

  for (let hour = 0; hour < 24; hour++) {
    const hourStart = new Date(dayStart);
    hourStart.setUTCHours(hour);
    const hourEnd = new Date(hourStart);
    hourEnd.setUTCHours(hour + 1);

    const result = await db.execute(sql`
      INSERT INTO performance_metrics_hourly (id, project_id, type, name, env, hour_bucket, count, sum, avg, min, max, p50, p75, p90, p95, p99)
      SELECT
        gen_random_uuid()::text,
        project_id,
        type,
        name,
        env,
        ${hourStart.toISOString()}::timestamptz AS hour_bucket,
        count(*)::int,
        sum(value)::real,
        avg(value)::real,
        min(value)::real,
        max(value)::real,
        COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY value), 0)::real,
        COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value), 0)::real,
        COALESCE(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY value), 0)::real,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value), 0)::real,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value), 0)::real
      FROM performance_metrics
      WHERE timestamp >= ${hourStart.toISOString()}::timestamptz
        AND timestamp < ${hourEnd.toISOString()}::timestamptz
      GROUP BY project_id, type, name, env
      ON CONFLICT (project_id, type, name, env, hour_bucket) DO UPDATE SET
        count = EXCLUDED.count,
        sum = EXCLUDED.sum,
        avg = EXCLUDED.avg,
        min = EXCLUDED.min,
        max = EXCLUDED.max,
        p50 = EXCLUDED.p50,
        p75 = EXCLUDED.p75,
        p90 = EXCLUDED.p90,
        p95 = EXCLUDED.p95,
        p99 = EXCLUDED.p99
    `);

    totalRows += result.length;
  }

  logger.info("Hourly metrics aggregation complete", {
    date: dayStart.toISOString().split("T")[0],
    rowsUpserted: totalRows,
  });

  return totalRows;
}

/**
 * Aggregate transactions into hourly buckets for a given date.
 * Includes pre-computed Apdex buckets (satisfied < 500ms, tolerating 500-2000ms, frustrated >= 2000ms).
 */
export async function aggregateHourlyTransactions(targetDate: Date): Promise<number> {
  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);

  let totalRows = 0;

  for (let hour = 0; hour < 24; hour++) {
    const hourStart = new Date(dayStart);
    hourStart.setUTCHours(hour);
    const hourEnd = new Date(hourStart);
    hourEnd.setUTCHours(hour + 1);

    const result = await db.execute(sql`
      INSERT INTO transaction_aggregates_hourly (
        id, project_id, name, op, env, hour_bucket,
        count, error_count, duration_sum, duration_avg, duration_min, duration_max,
        duration_p50, duration_p75, duration_p90, duration_p95, duration_p99,
        apdex_satisfied, apdex_tolerating, apdex_frustrated
      )
      SELECT
        gen_random_uuid()::text,
        project_id,
        name,
        op,
        env,
        ${hourStart.toISOString()}::timestamptz AS hour_bucket,
        count(*)::int,
        count(*) FILTER (WHERE status = 'error')::int,
        sum(duration)::real,
        avg(duration)::real,
        min(duration)::real,
        max(duration)::real,
        COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration), 0)::real,
        COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY duration), 0)::real,
        COALESCE(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY duration), 0)::real,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration), 0)::real,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration), 0)::real,
        count(*) FILTER (WHERE duration < ${APDEX_SATISFIED})::int,
        count(*) FILTER (WHERE duration >= ${APDEX_SATISFIED} AND duration < ${APDEX_TOLERATING})::int,
        count(*) FILTER (WHERE duration >= ${APDEX_TOLERATING})::int
      FROM transactions
      WHERE start_timestamp >= ${hourStart.toISOString()}::timestamptz
        AND start_timestamp < ${hourEnd.toISOString()}::timestamptz
      GROUP BY project_id, name, op, env
      ON CONFLICT (project_id, name, op, env, hour_bucket) DO UPDATE SET
        count = EXCLUDED.count,
        error_count = EXCLUDED.error_count,
        duration_sum = EXCLUDED.duration_sum,
        duration_avg = EXCLUDED.duration_avg,
        duration_min = EXCLUDED.duration_min,
        duration_max = EXCLUDED.duration_max,
        duration_p50 = EXCLUDED.duration_p50,
        duration_p75 = EXCLUDED.duration_p75,
        duration_p90 = EXCLUDED.duration_p90,
        duration_p95 = EXCLUDED.duration_p95,
        duration_p99 = EXCLUDED.duration_p99,
        apdex_satisfied = EXCLUDED.apdex_satisfied,
        apdex_tolerating = EXCLUDED.apdex_tolerating,
        apdex_frustrated = EXCLUDED.apdex_frustrated
    `);

    totalRows += result.length;
  }

  logger.info("Hourly transaction aggregation complete", {
    date: dayStart.toISOString().split("T")[0],
    rowsUpserted: totalRows,
  });

  return totalRows;
}

/**
 * Roll up hourly aggregates into daily buckets.
 * Uses weighted averages for percentiles (approximate but good enough for daily view).
 */
export async function aggregateDailyFromHourly(targetDate: Date): Promise<{ metrics: number; transactions: number }> {
  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  // Daily metrics rollup
  const metricsResult = await db.execute(sql`
    INSERT INTO performance_metrics_daily (
      id, project_id, type, name, env, day_bucket,
      count, sum, avg, min, max, p50, p75, p90, p95, p99
    )
    SELECT
      gen_random_uuid()::text,
      project_id,
      type,
      name,
      env,
      ${dayStart.toISOString()}::timestamptz AS day_bucket,
      sum(count)::int,
      sum(sum)::real,
      CASE WHEN sum(count) > 0 THEN (sum(sum) / sum(count))::real ELSE 0 END,
      min(min)::real,
      max(max)::real,
      -- Weighted average for percentiles (approximate)
      CASE WHEN sum(count) > 0 THEN (sum(p50 * count) / sum(count))::real ELSE 0 END,
      CASE WHEN sum(count) > 0 THEN (sum(p75 * count) / sum(count))::real ELSE 0 END,
      CASE WHEN sum(count) > 0 THEN (sum(p90 * count) / sum(count))::real ELSE 0 END,
      CASE WHEN sum(count) > 0 THEN (sum(p95 * count) / sum(count))::real ELSE 0 END,
      CASE WHEN sum(count) > 0 THEN (sum(p99 * count) / sum(count))::real ELSE 0 END
    FROM performance_metrics_hourly
    WHERE hour_bucket >= ${dayStart.toISOString()}::timestamptz
      AND hour_bucket < ${dayEnd.toISOString()}::timestamptz
    GROUP BY project_id, type, name, env
    ON CONFLICT (project_id, type, name, env, day_bucket) DO UPDATE SET
      count = EXCLUDED.count,
      sum = EXCLUDED.sum,
      avg = EXCLUDED.avg,
      min = EXCLUDED.min,
      max = EXCLUDED.max,
      p50 = EXCLUDED.p50,
      p75 = EXCLUDED.p75,
      p90 = EXCLUDED.p90,
      p95 = EXCLUDED.p95,
      p99 = EXCLUDED.p99
  `);

  // Daily transactions rollup
  const transResult = await db.execute(sql`
    INSERT INTO transaction_aggregates_daily (
      id, project_id, name, op, env, day_bucket,
      count, error_count, duration_sum, duration_avg, duration_min, duration_max,
      duration_p50, duration_p75, duration_p90, duration_p95, duration_p99,
      apdex_satisfied, apdex_tolerating, apdex_frustrated
    )
    SELECT
      gen_random_uuid()::text,
      project_id,
      name,
      op,
      env,
      ${dayStart.toISOString()}::timestamptz AS day_bucket,
      sum(count)::int,
      sum(error_count)::int,
      sum(duration_sum)::real,
      CASE WHEN sum(count) > 0 THEN (sum(duration_sum) / sum(count))::real ELSE 0 END,
      min(duration_min)::real,
      max(duration_max)::real,
      CASE WHEN sum(count) > 0 THEN (sum(duration_p50 * count) / sum(count))::real ELSE 0 END,
      CASE WHEN sum(count) > 0 THEN (sum(duration_p75 * count) / sum(count))::real ELSE 0 END,
      CASE WHEN sum(count) > 0 THEN (sum(duration_p90 * count) / sum(count))::real ELSE 0 END,
      CASE WHEN sum(count) > 0 THEN (sum(duration_p95 * count) / sum(count))::real ELSE 0 END,
      CASE WHEN sum(count) > 0 THEN (sum(duration_p99 * count) / sum(count))::real ELSE 0 END,
      sum(apdex_satisfied)::int,
      sum(apdex_tolerating)::int,
      sum(apdex_frustrated)::int
    FROM transaction_aggregates_hourly
    WHERE hour_bucket >= ${dayStart.toISOString()}::timestamptz
      AND hour_bucket < ${dayEnd.toISOString()}::timestamptz
    GROUP BY project_id, name, op, env
    ON CONFLICT (project_id, name, op, env, day_bucket) DO UPDATE SET
      count = EXCLUDED.count,
      error_count = EXCLUDED.error_count,
      duration_sum = EXCLUDED.duration_sum,
      duration_avg = EXCLUDED.duration_avg,
      duration_min = EXCLUDED.duration_min,
      duration_max = EXCLUDED.duration_max,
      duration_p50 = EXCLUDED.duration_p50,
      duration_p75 = EXCLUDED.duration_p75,
      duration_p90 = EXCLUDED.duration_p90,
      duration_p95 = EXCLUDED.duration_p95,
      duration_p99 = EXCLUDED.duration_p99,
      apdex_satisfied = EXCLUDED.apdex_satisfied,
      apdex_tolerating = EXCLUDED.apdex_tolerating,
      apdex_frustrated = EXCLUDED.apdex_frustrated
  `);

  const result = {
    metrics: metricsResult.length,
    transactions: transResult.length,
  };

  logger.info("Daily aggregation complete", {
    date: dayStart.toISOString().split("T")[0],
    ...result,
  });

  return result;
}

/**
 * Clean up raw performance data older than the retention period.
 */
export async function cleanupExpiredPerformanceData(retentionDays: number = 30): Promise<{
  metrics: number;
  transactions: number;
  spans: number;
}> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const metricsResult = await db.execute(sql`
    DELETE FROM performance_metrics WHERE timestamp < ${cutoff.toISOString()}::timestamptz
  `);

  // Delete spans first (FK constraint on transactions)
  const spansResult = await db.execute(sql`
    DELETE FROM spans WHERE transaction_id IN (
      SELECT id FROM transactions WHERE start_timestamp < ${cutoff.toISOString()}::timestamptz
    )
  `);

  const transResult = await db.execute(sql`
    DELETE FROM transactions WHERE start_timestamp < ${cutoff.toISOString()}::timestamptz
  `);

  const result = {
    metrics: metricsResult.length,
    transactions: transResult.length,
    spans: spansResult.length,
  };

  logger.info("Performance data cleanup complete", {
    retentionDays,
    cutoff: cutoff.toISOString(),
    ...result,
  });

  return result;
}

/**
 * Clean up old hourly aggregates (keep 12 months).
 */
export async function cleanupOldAggregates(retentionMonths: number = 12): Promise<{
  hourlyMetrics: number;
  hourlyTransactions: number;
}> {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - retentionMonths);

  const metricsResult = await db.execute(sql`
    DELETE FROM performance_metrics_hourly WHERE hour_bucket < ${cutoff.toISOString()}::timestamptz
  `);

  const transResult = await db.execute(sql`
    DELETE FROM transaction_aggregates_hourly WHERE hour_bucket < ${cutoff.toISOString()}::timestamptz
  `);

  const result = {
    hourlyMetrics: metricsResult.length,
    hourlyTransactions: transResult.length,
  };

  logger.info("Old aggregates cleanup complete", {
    retentionMonths,
    cutoff: cutoff.toISOString(),
    ...result,
  });

  return result;
}
