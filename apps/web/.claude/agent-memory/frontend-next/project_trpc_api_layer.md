---
name: tRPC and REST API dual-layer
description: tRPC router structure, REST API facade, server/client data fetching patterns for apps/web/
type: project
---

## Dual-Layer Pattern

```
Client Component → trpc.xxx.useQuery() → /api/trpc → router.ts → api.xxx() → fetchAPI → Hono API
Server Component → getServerCaller()   ─────────────────────────────┘
```

## tRPC Router (`src/server/trpc/router.ts`)

All routers defined inline in this file (except `adminRouter` imported from `routers/admin.ts`).

**`protectedProcedure`** middleware validates `session.user.id` via tRPC context. All procedures use it except `auth.getSession` and `members.checkInvite`.

### All Routers

| Key | Key procedures |
|---|---|
| `auth` | `getSession` (public) |
| `groups` | `getAll`, `getById`, `getEvents`, `getTimeline`, `updateStatus`, `batchUpdateStatus`, `merge`, `unmerge`, `snooze` |
| `stats` | `getGlobal`, `getTimeline`, `getEnvBreakdown`, `getSeverityBreakdown`, `getDashboardStats`, `getInsights` |
| `organizations` | `getAll`, `canCreate`, `create`, `delete` |
| `projects` | `getAll`, `getCurrent`, `setCurrent`, `canCreate`, `create`, `update`, `delete` |
| `projectSettings` | `get`, `update` |
| `members` | `getByOrganization`, `invite`, `checkInvite` (public), `acceptInvite`, `remove` |
| `apiKeys` | `getAll`, `create`, `delete` |
| `alerts` | `getRules`, `createRule`, `updateRule`, `deleteRule`, `getNotifications` |
| `onboarding` | `getStatus`, `setup` |
| `billing` | `getSummary`, `createCheckout`, `createPortal` |
| `replay` | `getSessions`, `getSessionsWithErrors`, `getSession`, `getSessionEvents` |
| `user` | `getProfile`, `updateProfile`, `getSessions`, `revokeSession`, `revokeAllSessions`, `canChangePassword` |
| `performance` | `getWebVitals`, `getTransactions`, `getTransaction`, `getSlowest`, `getSpanAnalysis`, `getApdex`, `getServerStats`, `getTopEndpoints` |
| `logs` | `tail` |
| `attention` | `getTop` |
| `cron` | `getMonitors`, `getMonitor`, `createMonitor`, `updateMonitor`, `deleteMonitor`, `getCheckins`, `getTimeline` |
| `infrastructure` | `getHosts`, `getLatest`, `getHistory` |
| `admin` | `getCronStatus`, `runJobSync`, `clearFailedJobs`, `isConfigured` |

## REST API Facade (`src/server/api/`)

- `client.ts` — `fetchAPI<T>(endpoint, options?)`: server-side fetch wrapper, reads cookies from `next/headers`, maps HTTP → TRPCError codes
- `index.ts` — aggregates all domain modules into `api` object
- Each domain module (e.g., `groups.ts`) exports pure async functions calling `fetchAPI`
- Types in `src/server/api/types/` — plain TypeScript interfaces (not Zod)

## Server-Side Helpers

- `getServerCaller()` — for Server Components (direct call, no HTTP)
- `createSSRHelpers()` — for SSR prefetch + `HydrationBoundary` with `superjson` transformer
