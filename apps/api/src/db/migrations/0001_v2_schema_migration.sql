-- ErrorWatch v2 Schema Migration
-- Run AFTER drizzle db:push (which adds the new columns)
-- This script handles: status migration, backfill, GIN index

-- 1. Migrate statuses: open -> unresolved, ignored/snoozed -> archived
UPDATE error_groups SET status = 'unresolved' WHERE status = 'open';
UPDATE error_groups SET status = 'archived' WHERE status IN ('ignored', 'snoozed');

-- 2. Backfill exception_type/exception_value on existing error_groups
-- Pattern: "ClassName: message" or "Namespace\ClassName: message"
UPDATE error_groups
SET
  exception_type = CASE
    WHEN message ~ '^[A-Za-z\\]+[A-Z][a-zA-Z]*:' THEN split_part(message, ': ', 1)
    ELSE 'Error'
  END,
  exception_value = CASE
    WHEN message ~ '^[A-Za-z\\]+[A-Z][a-zA-Z]*:' THEN substring(message FROM position(': ' IN message) + 2)
    ELSE message
  END
WHERE exception_type IS NULL;

-- 3. Backfill fingerprint_version on existing events (all are v1)
UPDATE error_events SET fingerprint_version = 1 WHERE fingerprint_version IS NULL OR fingerprint_version = 2;

-- 4. GIN index for tags JSONB containment queries (@>)
-- Cannot be created via Drizzle schema, must be done via raw SQL
CREATE INDEX IF NOT EXISTS idx_error_events_tags_gin ON error_events USING gin (tags jsonb_path_ops);
