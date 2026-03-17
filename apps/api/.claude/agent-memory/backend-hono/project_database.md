---
name: Drizzle ORM schema and conventions
description: All database tables, schema conventions, and Drizzle patterns for apps/api/
type: project
---

## Schema Location

Single file: `src/db/schema.ts` — ALL tables defined here. Always read before any DB work.

## Tables

| Table | SQL name | Group |
|---|---|---|
| `users` | `user` | Auth (BetterAuth) |
| `sessions` | `session` | Auth (BetterAuth) |
| `accounts` | `account` | Auth (BetterAuth) |
| `verifications` | `verification` | Auth (BetterAuth) |
| `organizations` | `organizations` | Multi-tenant |
| `organizationMembers` | `organization_members` | Multi-tenant |
| `projects` | `projects` | Multi-tenant |
| `invitations` | `invitations` | Multi-tenant |
| `apiKeys` | `api_keys` | Config |
| `alertRules` | `alert_rules` | Config |
| `notifications` | `notifications` | Config |
| `releases` | `releases` | Config |
| `sourcemaps` | `sourcemaps` | Config |
| `projectSettings` | `project_settings` | Config |
| `errorGroups` | `error_groups` | Error tracking |
| `errorEvents` | `error_events` | Error tracking |
| `applicationLogs` | `application_logs` | Logs |
| `performanceMetrics` | `performance_metrics` | Performance |
| `transactions` | `transactions` | Performance |
| `spans` | `spans` | Performance |
| `performanceMetricsHourly` | `performance_metrics_hourly` | Aggregation |
| `performanceMetricsDaily` | `performance_metrics_daily` | Aggregation |
| `transactionAggregatesHourly` | `transaction_aggregates_hourly` | Aggregation |
| `transactionAggregatesDaily` | `transaction_aggregates_daily` | Aggregation |
| `replaySessions` | `replay_sessions` | Session replay |
| `sessionEvents` | `session_events` | Session replay |
| `fingerprintRules` | `fingerprint_rules` | Custom fingerprint |
| `cronMonitors` | `cron_monitors` | Cron monitoring |
| `cronCheckins` | `cron_checkins` | Cron monitoring |
| `systemMetrics` | `system_metrics` | Infrastructure |

## Conventions

- Auth tables: singular snake_case (`user`, `session`) to match BetterAuth expectations
- All other tables: plural snake_case
- All IDs: `text` type (not integer/uuid)
- All timestamps: `timestamp({ withTimezone: true })`
- Semi-structured data: `jsonb` columns (`breadcrumbs`, `context`, `extra`, `tags`, `cpu`, `memory`)
- `errorGroups.fingerprint` is a SHA1 hash used as primary key (not auto-increment)
- Cascade deletes flow from `projects` → all feature tables
- Composite indexes defined inline as third argument of `pgTable()`

## Commands

- `bun run db:push` — push schema to dev database
- `bun run db:migrate` — run migrations in production
