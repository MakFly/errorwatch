# ErrorWatch — Vue + Vite Example

Minimal Vue 3 + Vite application demonstrating the ErrorWatch SDK integration.

## Setup

```bash
# From the monorepo root
bun install

# Copy environment variables
cp examples/vue-vite/.env.example examples/vue-vite/.env

# Edit .env with your API key
# VITE_ERRORWATCH_API_KEY=ew_live_...
```

## Run

```bash
cd examples/vue-vite
bun run dev
```

Open http://localhost:5173

## What it demonstrates

| Button | SDK call |
|--------|----------|
| Throw Vue error | `app.config.errorHandler` (set by `createPlugin()`) |
| captureException via composable | `useErrorMonitoring().captureException()` |
| captureException via SDK | `captureException()` from `@errorwatch/sdk` |
| captureMessage | `captureMessage()` from `@errorwatch/sdk` |
| addBreadcrumb | `addBreadcrumb()` from `@errorwatch/sdk` |

## SDK imports used

```ts
// Core SDK
import { init, captureException, captureMessage, addBreadcrumb } from "@errorwatch/sdk";

// Vue integration
import { createPlugin, useErrorMonitoring } from "@errorwatch/sdk/vue";
```
