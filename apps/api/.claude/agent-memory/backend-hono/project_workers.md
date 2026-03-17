---
name: BullMQ queue and worker patterns
description: Queue definitions, worker patterns, and event ingestion pipeline for apps/api/
type: project
---

## Queue Definitions

File: `src/queue/queues.ts` | Connection: `src/queue/connection.ts`

| Queue name | Purpose | Retries |
|---|---|---|
| `events` | Error event ingestion from SDKs | 3, exponential |
| `replays` | Session replay ingestion | 3, exponential |
| `alerts` | Alert notification dispatch | 5, exponential |
| `aggregation` | Hourly/daily aggregation + cleanup crons | 3, exponential |
| `metrics` | System metrics from infrastructure agents | 3, exponential |
| `cron-monitor` | Checks for missed/overdue cron jobs | 3, exponential |

## Worker Pattern

Files: `src/queue/workers/{name}.worker.ts`

```
import { Worker, Job } from "bullmq";
import { redisConnection } from "../connection";

async function processX(job: Job<XJobData>) { ... }

export const xWorker = new Worker<XJobData>("queue-name", processX, {
  ...redisConnection,
  concurrency: WORKER_CONCURRENCY,
});

xWorker.on("completed", ...);
xWorker.on("failed", ...);
export default xWorker;
```

## Event Ingestion Pipeline

`POST /api/v1/event` → `apiKeyMiddleware` → `EventController` → `eventQueue.add()` → `event.worker.ts`:

1. Scrub PII via `scrubPII()`
2. Check custom fingerprint rules (project-scoped, cached 60s)
3. Generate SHA1 fingerprint from `[projectId, errorType, normalizedFile, line, col, stackDepth, topFrames]`
4. Upsert `error_groups` with `onConflictDoUpdate` (atomic dedup + regression detection)
5. Insert `error_events` (catch `23505` for exact duplicate suppression)
6. Enqueue to `alertQueue`
7. Invalidate Redis cache (stats + groups list patterns)
8. Publish SSE event to dashboard via `publishEvent(orgId, ...)`
