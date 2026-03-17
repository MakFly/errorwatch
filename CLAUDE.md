# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ErrorWatch** - Self-hosted error monitoring SaaS for modern applications (Sentry alternative).

### Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────┐
│  Client Apps    │────▶│ Monitoring Server │◀────│  Dashboard  │
│  (SDKs)         │     │ (Hono + PostgreSQL)│     │  (Next.js)  │
└─────────────────┘     └───────────────────┘     └─────────────┘
       POST /event              ▲                    tRPC + REST
                                │
```

### Components

| Component | Location | Port | Stack |
|-----------|----------|------|-------|
| API Server | `apps/api/` | 3333 | Hono.js 4, Drizzle ORM, PostgreSQL, BetterAuth |
| Web Dashboard | `apps/web/` | 4001 | Next.js 16, tRPC 11, shadcn/ui, TailwindCSS |
| Symfony Bundle | [standalone repo](https://github.com/MakFly/errorwatch-sdk-symfony) | - | PHP 8.1+, Symfony 6.0+ |
| Laravel SDK | [standalone repo](https://github.com/MakFly/errorwatch-sdk-laravel) | - | PHP 8.1+, Laravel 10/11/12 |

> **Note:** `packages/` is gitignored. SDK packages are maintained in their own standalone repos. Files may exist locally for development but are not tracked in this monorepo.

### Local URLs

| Mode | Dashboard | API |
|------|-----------|-----|
| **Development** | http://localhost:4001 | http://localhost:3333 |
| **Production** | https://errorwatch.io | https://api.errorwatch.io |

---

## Project Structure

```
errorwatch/
├── apps/
│   ├── web/                       # Next.js 16 frontend
│   └── api/                       # Hono.js API server + BullMQ workers
├── packages/                      # ⚠️ gitignored — SDKs live in standalone repos
├── examples/                      # Integration examples
│   ├── react-vite/
│   ├── vue-vite/
│   └── example-symfony/
├── docs/                          # Documentation
├── docker-compose.yml             # Dev infra (Postgres + Redis)
├── docker-compose.prod.yml       # Full-Docker production stack
├── package.json                   # Workspaces root
├── turbo.json                     # Turborepo config
├── tsconfig.base.json             # Base TypeScript config
├── Makefile                       # Dev commands
└── CLAUDE.md
```

---

## API Server (`apps/api/`)

### Database Schema

| Table | Purpose |
|-------|---------|
| `user` | User accounts (BetterAuth managed) |
| `session` | Session tokens (BetterAuth managed) |
| `account` | OAuth provider accounts |
| `organizations` | Multi-tenant organizations |
| `organization_members` | User roles (owner/admin/member) |
| `projects` | Projects within organizations |
| `invitations` | Pending invite tokens (7-day expiry) |
| `error_groups` | Grouped errors by fingerprint |
| `error_events` | Individual error occurrences |

### API Versioning

- URL path versioning: `/api/v1/*`
- Current version: **v1**
- Router: `src/api/v1/index.ts`

### Database

- **PostgreSQL** 16 (production) via Docker
- **Redis** 7 (queues & caching)
- Drizzle ORM with migrations

### Authentication

Uses **BetterAuth** (`src/auth.ts`):
- Email/password authentication
- PostgreSQL session storage
- Trusted origins configured in CORS

### Commands

```bash
cd apps/api
bun install
make docker-up       # Start PostgreSQL & Redis first (from root)
bun run db:push      # Push schema to PostgreSQL
bun run dev:standalone  # Port 3333
```

---

## Web Dashboard (`apps/web/`)

### Route Structure

```
src/app/
├── (marketing)/           # Public pages
│   ├── layout.tsx         # Navbar + Footer
│   └── page.tsx           # Landing page
├── (dashboard)/           # Protected pages
│   ├── layout.tsx         # Sidebar + MobileHeader
│   ├── page.tsx           # Dashboard overview
│   ├── issues/            # Error issues list
│   ├── stats/             # Statistics & charts
│   └── settings/          # Settings (orgs, alerts, API keys)
├── (auth)/                # Auth pages
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (onboarding)/          # Onboarding flow
│   ├── layout.tsx         # Minimal layout (logo only)
│   ├── onboarding/page.tsx # Wizard (create org + project)
│   └── invite/[token]/page.tsx # Accept invitation
└── api/trpc/[trpc]/       # tRPC API route
```

### tRPC Architecture

```
Client Component → trpc.xxx.useQuery() → /api/trpc → router.ts → api.ts → Monitoring Server
Server Component → getServerCaller()   ─────────────────────────────────┘
```

**Routers** (`src/server/trpc/router.ts`):
- `auth` - getSession
- `groups` - getAll, getById, getEvents, getTimeline
- `stats` - getGlobal, getTimeline, getEnvBreakdown, getDashboardStats
- `organizations` - getAll, create, delete
- `projects` - getAll, getCurrent, setCurrent, create, delete
- `members` - getByOrganization, invite, checkInvite, acceptInvite, remove
- `onboarding` - getStatus, setup

### Commands

```bash
cd apps/web
bun install
bun run dev:standalone  # Port 4001
```

---

## SDK Packages (standalone repos)

`packages/` is **gitignored** — SDK packages are maintained in their own repositories:

| SDK | Repo | Package |
|-----|------|---------|
| Symfony Bundle | [errorwatch-sdk-symfony](https://github.com/MakFly/errorwatch-sdk-symfony) | `errorwatch/sdk-symfony` (Packagist) |
| Laravel SDK | [errorwatch-sdk-laravel](https://github.com/MakFly/errorwatch-sdk-laravel) | `errorwatch/sdk-laravel` (Packagist) |

### Subtree remotes

Remotes `sdk-symfony` and `sdk-laravel` are configured for subtree operations:

```bash
# Push local changes to standalone repo
git subtree split --prefix=packages/sdk-symfony -b sdk-symfony-release
git push sdk-symfony sdk-symfony-release:main

git subtree split --prefix=packages/sdk-laravel -b sdk-laravel-release
git push sdk-laravel sdk-laravel-release:main
```

### Tests

```bash
cd packages/sdk-laravel
composer install
composer test
```

Current test status: **73 tests, 137 assertions** ✅

---

## Documentation

**IMPORTANT:** Before modifying code, read:

```
docs/
├── README.md                    # Documentation index
├── ARCHITECTURE.md              # Architecture générale
├── DEVELOPMENT/
│   ├── README.md                # Dev docs index
│   └── LOGGER.md                # Logger system (monitoring-server)
├── SECURITY/
│   ├── README.md                # Security docs index
│   ├── AUDIT_INDEX.md           # General security audit
│   └── PHP_SDKS_AUDIT_INDEX.md  # PHP SDKs security audit
└── INTEGRATIONS.md              # Third-party integrations

AI-DD/
├── README.md              # Overview
└── trpc/
    ├── ARCHITECTURE.md    # tRPC architecture (dashboard)
    └── CONVENTIONS.md     # Coding conventions & patterns

resolve-bugs/
└── replay-player-progress-sync.md  # Bug fixes documentation
```

---

## Development Notes

- **Dev servers are always running** (hot-reload active)
- **Never run** `bun dev`, `npm run dev` or similar - servers already started
- Test API with `curl` or browser

### Next.js 16 Specifics

- **NO `middleware.ts`** - Next.js 16 utilise `src/proxy.ts` à la place
- Le proxy gère : authentification, redirection, validation de session
- Voir `apps/web/src/proxy.ts` pour la logique de routing

---

## Quick Commands (from project root)

```bash
# Development (standalone)
make dev             # Start dev servers (http://localhost:4001)
make stop            # Stop all servers
make restart         # Restart all servers
make status          # Check server status

# Setup & Database
make install         # Install all dependencies
make db-push         # Push database schema
make db-migrate      # Run migrations

# Testing & Build
make test-api        # Test API endpoints
make build           # Build for production
make clean           # Clean build artifacts
```

---

## Multi-tenant Architecture

### Organizations
- **1 user = 1 organization** (constraint enforced in backend)
- Users can be invited to other organizations as members
- Each org has members with roles: `owner`, `admin`, `member`

### Projects
- Projects belong to organizations
- Errors are scoped to projects
- Users select active project in dashboard

### Onboarding Flow
1. User signs up → lands on `/onboarding`
2. Creates organization + first project in one step
3. Receives API key automatically
4. Redirected to `/dashboard`

### Invitation Flow
1. Owner/Admin sends invite → creates token with 7-day expiry
2. Invitee receives email with `/invite/{token}` link
3. Invitee signs up/logs in → lands on `/invite/{token}`
4. Accepts invite → joins organization as `member`
5. Redirected to `/dashboard` (bypasses onboarding)
