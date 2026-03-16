-- Migration: sampleRate text→real, sessionEvents dedup index adds type column
-- Item 1: change project_settings.sample_rate from text to real
ALTER TABLE "project_settings"
  ALTER COLUMN "sample_rate" TYPE real USING "sample_rate"::real;

ALTER TABLE "project_settings"
  ALTER COLUMN "sample_rate" SET DEFAULT 1.0;

-- Item 2: rebuild sessionEvents dedup unique index to include type column
DROP INDEX IF EXISTS "idx_session_events_dedup";

CREATE UNIQUE INDEX "idx_session_events_dedup"
  ON "session_events" ("session_id", "type", "timestamp");
