# ErrorWatch — React + Vite Example

A minimal React 19 + Vite 6 application demonstrating the `@errorwatch/sdk` integration.

## Features demonstrated

- `init()` — SDK initialization with DSN and API key
- `createErrorBoundary(React)` — React ErrorBoundary for uncaught render errors
- `captureException()` — manual exception capture
- `captureMessage()` — send a custom message event
- `addBreadcrumb()` — attach breadcrumbs before the next captured event
- `useErrorMonitoring()` — React hook for error capture inside components

## Setup

```bash
# 1. Install dependencies (from monorepo root)
bun install

# 2. Copy the environment file and fill in your values
cp .env.example .env

# 3. Start the dev server
bun run dev
```

The app will be available at http://localhost:5173.

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `VITE_ERRORWATCH_DSN` | URL of the monitoring server | `http://localhost:3333` |
| `VITE_ERRORWATCH_API_KEY` | Project API key from the dashboard | `ew_test_xxx` |

Make sure the monitoring server is running (`make dev` from the monorepo root) before testing event capture.
