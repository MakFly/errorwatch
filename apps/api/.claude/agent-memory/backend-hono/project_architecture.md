---
name: API layered architecture
description: Route → Controller → Service → Repository pattern with naming conventions and layer responsibilities for apps/api/
type: project
---

## Layered Architecture

Strict layer ordering: **Route → Controller → Service → Repository**. No cross-layer shortcuts except controllers calling repositories directly for simple bulk operations (performance exception).

### Route Layer (`src/routes/v1/`)

- Each domain gets its own file, aggregated in `index.ts` via `v1.route("/groups", groups)`
- Middleware applied at router level: `router.use("*", auth())`
- Controllers imported as namespace: `import * as GroupController from "../../controllers/v1/GroupController"`
- Handler wrapping: `asHandler(GroupController.getAll)` — casts `AuthContext` to standard Hono `Handler`
- Path params declared AFTER named sub-paths (e.g., `/batch/status` before `/:fingerprint`)

### Controller Layer (`src/controllers/v1/`)

- **Plain exported functions** (never classes): `export const getAll = async (c: AuthContext) => { ... }`
- User identity: always `c.get("userId")` (injected by auth middleware)
- Authorization: `verifyProjectAccess(projectId, userId)` called explicitly before data access
- Error responses: `c.json({ error: "..." }, 400|403|404)`
- Naming: `XController.ts`, functions named `getAll`, `getById`, `updateStatus`, etc.

### Service Layer (`src/services/`)

- **Object literals** with async methods: `export const GroupService = { getAll: async (...) => { ... } }`
- Business logic: data composition, pagination, timeline generation
- May call multiple repositories
- Returns plain JS objects/arrays or `null` (no custom error classes)
- Some functional modules exist: `scrubber.ts`, `project-access.ts`, `api-keys.ts`

### Repository Layer (`src/repositories/`)

- **Object literals** wrapping Drizzle queries
- Simple queries: `db.select().from(table).where(eq(...))`
- Complex queries: `db.execute(sql`...`)` with manual snake_case → camelCase mapping
- Import specific operators: `import { eq, desc, sql, and } from "drizzle-orm"`
- Always import `db` from `../db/connection` and tables from `../db/schema`

### All Domain Modules

Routes: `billing`, `projects`, `organizations`, `members`, `api-keys`, `stats`, `groups`, `onboarding`, `event`, `admin`, `alerts`, `project-settings`, `releases`, `sourcemaps`, `performance`, `replay`, `user`, `dev`, `export`, `logs`, `metrics`, `metrics-sse`, `cron`, `infrastructure`
