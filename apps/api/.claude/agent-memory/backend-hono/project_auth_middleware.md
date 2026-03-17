---
name: Auth and middleware patterns
description: BetterAuth config, session/auth/api-key middleware, and rate limiting for apps/api/
type: project
---

## BetterAuth Configuration

File: `src/auth.ts`

- Uses `drizzleAdapter(db, { provider: "pg" })` with explicit schema mapping to `users`, `sessions`, `accounts`, `verifications`
- Email/password enabled
- Social providers: GitHub + Google (conditionally via env vars), account linking enabled
- Cookie: `sameSite: "lax"`, `secure` in prod, `httpOnly: true`, domain-scoped in prod
- Trusted origins configured for CORS

## Middleware Stack (`src/middleware/`)

| Middleware | Scope | What it does |
|---|---|---|
| `session.ts` | **Global** (all routes) | Calls `auth.api.getSession()`, sets `c.set("session", { user })` |
| `auth.ts` | **Per-router** | Guard: checks `c.get("session")?.user?.id`, sets `userId` and `user` on context |
| `api-key.ts` | SDK ingestion routes | Validates `X-API-Key` header (format: `ew_(live\|test)_...`), caches result, sets `c.set("apiKey", { id, projectId })` |
| `rate-limit.ts` | Configurable per-route | Redis-backed token bucket, falls back to in-memory, disabled in dev |
| `admin-auth.ts` | Admin routes | Admin-only guard |
| `security-headers.ts` | Global | Adds security HTTP headers |

## Context Types

File: `src/types/hono.ts` — defines `AppEnv` type for Hono context variable map.
File: `src/types/context.ts` — defines `AuthContext` type used by all controller handlers.

### Usage Pattern

- `c.get("userId")` — string, set by `auth.ts` middleware
- `c.get("user")` — full user object
- `c.get("session")` — session object (set by `session.ts`)
- `c.get("apiKey")` — `{ id, projectId }` (set by `api-key.ts`)
