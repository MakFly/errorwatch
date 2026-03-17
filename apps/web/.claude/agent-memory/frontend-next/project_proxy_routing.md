---
name: Proxy routing and auth logic
description: Next.js 16 proxy.ts replaces middleware.ts — session validation, redirects, auth flow for apps/web/
type: project
---

## proxy.ts (replaces middleware.ts)

File: `src/proxy.ts` — Next.js 16 pattern, NO `middleware.ts` exists.

### Flow

1. API/static routes → `NextResponse.next()` (bypassed)
2. All other routes → run `next-intl` middleware first → get `intlResponse`
3. Self-hosted mode: `/` → redirect `/login`
4. Public routes: `["/", "/login", "/signup", "/invite"]` — returned with intl propagation
5. Auth routes (`/login`, `/signup`) + valid session → redirect `/dashboard`
6. No session cookie → redirect `/login?redirect=<pathname>`
7. Session validated against `${API_URL}/api/auth/get-session` with forwarded cookies
8. Session cache: in-process `Map` with 30s TTL, max 1000 entries (LRU)
9. `/dashboard` (bare) → fetches onboarding status + org list → redirects to `/onboarding` or `/dashboard/${org[0].slug}`
10. `/onboarding` + onboarding complete → redirect `/dashboard`
11. `FAIL_OPEN=true` (non-prod default): auth errors silently swallowed

### Helper

`propagateIntlCookies(intlResponse, response)` — merges `x-next-intl-*` cookies/headers from intl response into custom responses.
