# @errorwatch/sdk

Universal error monitoring SDK for ErrorWatch. Works in browser, React, and Vue applications.

## Installation

```bash
npm install @errorwatch/sdk
```

React and Vue are optional peer dependencies — install the ones you need:

```bash
npm install @errorwatch/sdk react        # React 18+ or 19+
npm install @errorwatch/sdk vue          # Vue 3+
```

---

## Browser / Vanilla JS

Import from `@errorwatch/sdk`.

```typescript
import { init, captureException, captureMessage } from '@errorwatch/sdk'

init({
  dsn: 'http://localhost:3333',
  apiKey: 'ew_live_...',
  environment: 'production',
  release: '1.0.0',
})

// Capture an exception
try {
  riskyOperation()
} catch (e) {
  captureException(e)
}

// Capture a message
captureMessage('Checkout completed', { level: 'info' })
```

Global error handlers (`window.onerror`, `unhandledrejection`) are set up automatically after `init()`.

### Core functions

| Function | Signature | Description |
|---|---|---|
| `init` | `(config: SDKConfig) => Client` | Initialize the SDK (call once at app startup) |
| `captureException` | `(error: unknown, options?: CaptureOptions) => void` | Capture an exception |
| `captureMessage` | `(message: string, options?: CaptureOptions) => void` | Capture a message |
| `setUser` | `(user: User \| null) => void` | Set or clear the current user context |
| `addBreadcrumb` | `(breadcrumb: Omit<Breadcrumb, 'timestamp'>) => void` | Add a manual breadcrumb |
| `getReplaySessionId` | `() => string \| null` | Get the current replay session ID |
| `flush` | `() => Promise<void>` | Flush pending events to the server |
| `close` | `() => void` | Shut down the SDK and release all resources |
| `getClient` | `() => Client \| null` | Get the underlying `Client` instance |

---

## React

Import from `@errorwatch/sdk/react`.

```tsx
import React from 'react'
import { init, createErrorBoundary, useErrorMonitoring } from '@errorwatch/sdk/react'

// Initialize once at app startup
init({
  dsn: 'http://localhost:3333',
  apiKey: 'ew_live_...',
  environment: 'production',
})

// Create the ErrorBoundary by passing your React instance
const ErrorBoundary = createErrorBoundary(React)

function App() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <MyApp />
    </ErrorBoundary>
  )
}
```

### `createErrorBoundary(React)`

The SDK does not ship a pre-built `ErrorBoundary` component to avoid SSR issues. You must create one by passing your `React` import to the factory function. The returned class component accepts:

| Prop | Type | Description |
|---|---|---|
| `children` | `ReactNode` | Content to protect |
| `fallback` | `ReactNode` | UI to render when an error is caught (optional) |
| `onError` | `(error: Error, errorInfo: any) => void` | Custom error handler called alongside capture (optional) |

### `useErrorMonitoring()`

React hook that returns the capture functions bound to the global client.

```tsx
function MyComponent() {
  const { captureException, captureMessage, setUser, addBreadcrumb, getReplaySessionId } =
    useErrorMonitoring()

  const handleClick = () => {
    captureMessage('User clicked checkout', { level: 'info' })
  }

  return <button onClick={handleClick}>Checkout</button>
}
```

### Other exports from `@errorwatch/sdk/react`

`init`, `close`, `flush`, `getClient` — same as the core entry point.

---

## Vue

Import from `@errorwatch/sdk/vue`.

```typescript
// main.ts
import { createApp } from 'vue'
import { init, createPlugin } from '@errorwatch/sdk/vue'
import App from './App.vue'

init({
  dsn: 'http://localhost:3333',
  apiKey: 'ew_live_...',
  environment: 'production',
})

const app = createApp(App)
app.use(createPlugin())
app.mount('#app')
```

`createPlugin()` installs a Vue 3 `errorHandler` that automatically captures component errors and attaches component context (`componentInfo`, `componentName`) as extra data.

### `useErrorMonitoring()`

Vue composable that returns the same capture functions as the React hook.

```typescript
// MyComponent.vue
import { useErrorMonitoring } from '@errorwatch/sdk/vue'

export default {
  setup() {
    const { captureException, captureMessage, setUser, addBreadcrumb, getReplaySessionId } =
      useErrorMonitoring()

    const handleError = () => {
      try {
        riskyOperation()
      } catch (e) {
        captureException(e)
      }
    }

    return { handleError }
  }
}
```

### Other exports from `@errorwatch/sdk/vue`

`init`, `close`, `flush`, `getClient` — same as the core entry point.

---

## Configuration reference

All options for `SDKConfig` passed to `init()`:

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | **Required.** Your project API key |
| `dsn` | `string` | `'http://localhost:3333'` | API server URL (alias for `endpoint`) |
| `endpoint` | `string` | `'http://localhost:3333'` | API server URL |
| `environment` | `string` | `'production'` | Environment name sent with every event |
| `release` | `string` | — | Release version sent with every event |
| `debug` | `boolean` | `false` | Log verbose debug output to the console |
| `sampleRate` | `number` | `1.0` | Fraction of events to send (0.0–1.0) |
| `maxQueueSize` | `number` | `30` | Max events held in the send queue |
| `flushInterval` | `number` | `5000` | Queue flush interval in milliseconds |
| `beforeSend` | `(event: ErrorEvent) => ErrorEvent \| null` | — | Hook to mutate or drop events before sending |
| `replay` | `ReplayConfig` | — | Session replay options (see below) |
| `breadcrumbs` | `BreadcrumbConfig` | — | Breadcrumb capture options (see below) |
| `transport` | `TransportConfig` | — | Transport retry and callback options (see below) |

### `ReplayConfig`

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Enable session replay |
| `replaysSessionSampleRate` | `number` | `0` | Fraction of sessions recorded continuously |
| `replaysOnErrorSampleRate` | `number` | `1.0` | Fraction of sessions recorded on error (buffer mode) |
| `maskAllInputs` | `boolean` | — | Mask all input fields in recordings |
| `maskTextSelector` | `string` | — | CSS selector for text nodes to mask |
| `blockSelector` | `string` | — | CSS selector for elements to block entirely |
| `maxReplayDuration` | `number` | — | Max session recording duration in milliseconds |
| `flushInterval` | `number` | — | How often to flush replay events in milliseconds |
| `postErrorBuffer` | `number` | — | Extra milliseconds to capture after an error before flushing |

### `BreadcrumbConfig`

| Option | Type | Description |
|---|---|---|
| `enabled` | `boolean` | Enable automatic breadcrumb collection (default: `true`) |
| `maxBreadcrumbs` | `number` | Max breadcrumbs to keep per event |
| `enableConsoleCapture` | `boolean` | Capture `console.*` calls as breadcrumbs |
| `enableClickCapture` | `boolean` | Capture click events as breadcrumbs |
| `enableNavigationCapture` | `boolean` | Capture navigation events as breadcrumbs |
| `enableFetchCapture` | `boolean` | Capture `fetch` requests as breadcrumbs |
| `enableXHRCapture` | `boolean` | Capture XHR requests as breadcrumbs |

### `TransportConfig`

| Option | Type | Default | Description |
|---|---|---|---|
| `maxRetries` | `number` | `3` | Number of retry attempts on failure |
| `retryDelay` | `number` | `1000` | Initial retry delay in ms (doubles each attempt) |
| `onError` | `(error: TransportError) => void` | — | Called when an event fails to send |
| `onSuccess` | `() => void` | — | Called when an event is sent successfully |

`TransportError` carries a `code` field (`TransportErrorCode`) — for example `'INGESTION_DISABLED'` when the project has disabled event ingestion.

### `CaptureOptions`

Options accepted by `captureException()` and `captureMessage()`:

| Option | Type | Description |
|---|---|---|
| `level` | `'debug' \| 'info' \| 'warning' \| 'error' \| 'fatal'` | Severity level |
| `user` | `User` | Override the current user context for this event |
| `tags` | `Record<string, string>` | Key-value tags attached to the event |
| `extra` | `Record<string, unknown>` | Arbitrary extra data attached to the event |

---

## TypeScript

The package ships full TypeScript declarations. All types are re-exported from each entry point:

```typescript
import type { SDKConfig, User, CaptureOptions, Breadcrumb, ReplayConfig, TransportConfig } from '@errorwatch/sdk'
```

---

## Project

Part of the [ErrorWatch](https://github.com/MakFly/sentry-like) monorepo — a self-hosted error monitoring platform.
