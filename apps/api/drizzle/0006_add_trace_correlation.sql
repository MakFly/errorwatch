-- Trace correlation across error_events, application_logs, and spans
-- Enables linking logs/errors back to their full distributed trace

ALTER TABLE "error_events"     ADD COLUMN IF NOT EXISTS "trace_id" text;
ALTER TABLE "error_events"     ADD COLUMN IF NOT EXISTS "span_id"  text;

ALTER TABLE "application_logs" ADD COLUMN IF NOT EXISTS "trace_id" text;
ALTER TABLE "application_logs" ADD COLUMN IF NOT EXISTS "span_id"  text;

-- Denormalize trace_id onto spans to avoid JOIN on every aggregation
ALTER TABLE "spans"            ADD COLUMN IF NOT EXISTS "trace_id" text;

CREATE INDEX IF NOT EXISTS idx_error_events_trace_id
  ON error_events (trace_id)
  WHERE trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_application_logs_trace_id
  ON application_logs (trace_id)
  WHERE trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spans_trace_id
  ON spans (trace_id)
  WHERE trace_id IS NOT NULL;

-- Backfill spans.trace_id from their parent transaction
UPDATE spans
SET trace_id = t.trace_id
FROM transactions t
WHERE spans.transaction_id = t.id
  AND spans.trace_id IS NULL
  AND t.trace_id IS NOT NULL;
