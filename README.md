<div align="center">

# ErrorWatch

**Self-hosted error monitoring for modern applications**

A lightweight, privacy-focused alternative to Sentry. Monitor errors, track performance, and replay user sessions — all on your own infrastructure.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Hono](https://img.shields.io/badge/Hono-4.0-E36002?logo=hono)](https://hono.dev/)

[Features](#features) · [Quick Start](#quick-start) · [SDKs](#sdks) · [Self-Hosting](#self-hosting) · [Documentation](#documentation)

</div>

---

## Features

- **Error Tracking** — Automatic capture with fingerprinting, grouping, and severity levels
- **Session Replay** — Replay user sessions with rrweb integration
- **Performance Monitoring** — Request durations, database queries, N+1 detection
- **Infrastructure Monitoring** — CPU, memory, disk, network via Go agent
- **Multi-tenant** — Organizations, projects, and role-based access control
- **Real-time Dashboard** — Next.js 16 dashboard with tRPC and live SSE updates
- **Internationalization** — English and French out of the box
- **Privacy-First** — Self-hosted, your data stays on your infrastructure
- **Multiple SDKs** — JavaScript, React, Vue, Symfony, Laravel, Go metrics

## Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────┐
│  Client Apps    │────▶│   API Server      │◀────│  Dashboard  │
│  (SDKs)         │     │ (Hono + PostgreSQL)│     │  (Next.js)  │
└─────────────────┘     └───────────────────┘     └─────────────┘
       POST /event              ▲                    tRPC + REST
                                │
                     ┌──────────┴──────────┐
                     │  PostgreSQL + Redis  │
                     └─────────────────────┘
```

| Component | Location | Port | Stack |
|-----------|----------|------|-------|
| API Server | `apps/api/` | 3333 | Hono.js 4, Drizzle ORM, PostgreSQL 16, Redis 7, BullMQ |
| Dashboard | `apps/web/` | 4001 | Next.js 16, React 19, tRPC 11, shadcn/ui, TailwindCSS |

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Bun](https://bun.sh/) 1.x

### 1. Clone & Install

```bash
git clone https://github.com/MakFly/errorwatch.git
cd errorwatch
make install
```

### 2. Start Infrastructure

```bash
make infra-up       # PostgreSQL + Redis via Docker
make infra-wait     # Wait for healthy containers
```

### 3. Configure Environment

```bash
# API — edit with your values
cp apps/api/.env.example apps/api/.env

# Dashboard
cp apps/web/.env.local.example apps/web/.env.local
```

### 4. Setup Database

```bash
make db-push
```

### 5. Start Development

```bash
make dev            # API (3333) + Dashboard (4001)
```

- **Dashboard**: http://localhost:4001
- **API**: http://localhost:3333

## Project Structure

```
errorwatch/
├── apps/
│   ├── api/                  # Hono.js API server + BullMQ workers
│   └── web/                  # Next.js 16 dashboard
├── deploy/                   # Production deployment (Caddy, PM2, scripts)
├── examples/
│   └── laravel-api/          # Laravel integration example
├── scripts/                  # Release & setup helpers
├── docker-compose.yml        # Dev infra (PostgreSQL + Redis)
├── docker-compose.prod.yml   # Full Docker production stack
├── Dockerfile                # Multi-target (api + web)
├── Makefile                  # All dev/prod commands
└── turbo.json                # Turborepo config
```

> `packages/` is gitignored — SDK packages live in their own standalone repositories.

## SDKs

### JavaScript / TypeScript

```bash
npm install @errorwatch/sdk
```

```typescript
import { ErrorWatch } from '@errorwatch/sdk';

ErrorWatch.init({
  dsn: 'https://api.errorwatch.io',
  apiKey: 'ew_live_your_project_api_key',
});
```

### React

```tsx
import { ErrorBoundary } from '@errorwatch/sdk/react';

<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

### Vue

```typescript
import { createApp } from 'vue';
import { ErrorWatchPlugin } from '@errorwatch/sdk/vue';

const app = createApp(App);
app.use(ErrorWatchPlugin, { dsn: '...', apiKey: '...' });
```

### Symfony

```bash
composer require errorwatch/sdk-symfony
```

```yaml
# config/packages/errorwatch.yaml
errorwatch:
  dsn: '%env(ERRORWATCH_DSN)%'
  api_key: '%env(ERRORWATCH_API_KEY)%'
```

> Repo: [errorwatch-sdk-symfony](https://github.com/MakFly/errorwatch-sdk-symfony)

### Laravel

```bash
composer require errorwatch/sdk-laravel
```

```php
// .env
ERRORWATCH_DSN=https://api.errorwatch.io
ERRORWATCH_API_KEY=ew_live_your_key
```

> Repo: [errorwatch-sdk-laravel](https://github.com/MakFly/errorwatch-sdk-laravel)

### Infrastructure Metrics (Go Agent)

Collect CPU, memory, disk, and network metrics from your servers.

```bash
git clone https://github.com/MakFly/errorwatch-sdk-metrics.git
cd errorwatch-sdk-metrics
go build -o sdk-metrics .
./sdk-metrics --init
./sdk-metrics -c sdk-metrics.yaml
```

> Repo: [errorwatch-sdk-metrics](https://github.com/MakFly/errorwatch-sdk-metrics)

## Self-Hosting

### Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 2 GB | 4 GB+ |
| CPU | 2 vCPU | 4 vCPU+ |
| Storage | 20 GB | 50 GB+ SSD |
| OS | Ubuntu 22.04+ | Ubuntu 24.04 LTS |

Required: Docker Engine, Bun 1.x, PM2

### Deployment Model

Production topology uses **PM2** for apps and **Docker** for infrastructure:

| Service | Runtime |
|---------|---------|
| API Server | PM2 (port 3333) |
| Dashboard | PM2 (port 4001) |
| PostgreSQL | Docker |
| Redis | Docker |
| Caddy | Docker (TLS + reverse proxy) |

### Production Setup

```bash
# 1. Clone on VPS
git clone https://github.com/MakFly/errorwatch.git /opt/errorwatch
cd /opt/errorwatch

# 2. Configure environment
cp deploy/.env.production.example .env.production
nano .env.production

# 3. Generate secrets
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 24   # POSTGRES_PASSWORD
openssl rand -base64 24   # API_KEY_HASH_SECRET

# 4. First deployment
./deploy/first-init-deploy.sh .env.production

# 5. Subsequent updates
./deploy/deploy.sh .env.production
```

### Required Environment Variables

```bash
# URLs
DOMAIN=errorwatch.io
DASHBOARD_URL=https://errorwatch.io
API_URL=https://api.errorwatch.io
BETTER_AUTH_URL=https://api.errorwatch.io
NEXT_PUBLIC_APP_URL=https://errorwatch.io
NEXT_PUBLIC_MONITORING_API_URL=https://api.errorwatch.io

# Database
POSTGRES_PASSWORD=<generated>
DATABASE_URL=postgresql://errorwatch:<password>@localhost:55432/errorwatch
REDIS_URL=redis://localhost:56379

# Security
BETTER_AUTH_SECRET=<generated>
ADMIN_API_KEY=ew_admin_<generated>
API_KEY_HASH_SECRET=<generated>
ACME_EMAIL=admin@errorwatch.io
```

Optional: `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `RESEND_API_KEY`, Stripe keys.

### Health Checks

```bash
curl -s http://127.0.0.1:3333/health/live   # API
curl -s http://127.0.0.1:4001/               # Dashboard
```

### Operations

```bash
bunx pm2 list                    # Process status
bunx pm2 logs                    # Application logs
bunx pm2 restart all             # Restart apps
make prod-status                 # Docker infra status
make prod-logs                   # Docker infra logs
./deploy/deploy.sh .env.production  # Deploy update
```

For the complete VPS deployment guide, see [deploy/README.md](./deploy/README.md).

For security hardening (UFW + Fail2ban), see [deploy/SECURITY-HARDENING-UFW-FAIL2BAN.md](./deploy/SECURITY-HARDENING-UFW-FAIL2BAN.md).

## Development

### Makefile Commands

```bash
make install        # Install all dependencies
make dev            # Start API + Dashboard
make dev-api        # API only (port 3333)
make dev-web        # Dashboard only (port 4001)
make stop           # Stop dev processes
make status         # Check service health

make infra-up       # Start PostgreSQL + Redis
make infra-down     # Stop infrastructure
make db-push        # Push schema to database
make db-migrate     # Run migrations
make db-reset       # Reset database (destructive)

make build          # Build all apps
make clean          # Clean build artifacts
```

### Running Tests

```bash
bun test apps/api/tests     # API tests
```

### Releases

```bash
./scripts/release.sh --type patch                    # Auto bump
./scripts/release.sh --version v1.0.0 --notes "1.0"  # Explicit version
./scripts/release.sh --type minor --dry-run           # Preview only
```

## CI/CD

GitHub Actions workflows:

| Workflow | File | Trigger |
|----------|------|---------|
| CI | `ci.yml` | push to main, PRs |
| Security | `security.yml` | push to main, PRs |
| CD Production | `cd-production.yml` | manual dispatch |

Required GitHub secrets for CD: `PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY`.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT — see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with [Hono](https://hono.dev/), [Next.js](https://nextjs.org/), [Drizzle ORM](https://orm.drizzle.team/), and [rrweb](https://www.rrweb.io/). Inspired by [Sentry](https://sentry.io/).

---

<div align="center">

Made by [MakFly](https://github.com/MakFly)

</div>
