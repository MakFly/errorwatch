# ErrorWatch — Symfony Example

Minimal Symfony application demonstrating integration with the `errorwatch/sdk-symfony` bundle.

## Prerequisites

- PHP 8.1+
- Composer
- Symfony CLI (optional, for the local server)
- ErrorWatch monitoring server running at `http://localhost:3333`

## Setup

```bash
# 1. Copy env file and fill in your values
cp .env.example .env

# 2. Install dependencies (uses the local path repository pointing to ../../packages/sdk-symfony)
composer install

# 3. Start the built-in server (choose one)
symfony server:start          # Symfony CLI — recommended
php -S localhost:8080 public/ # PHP built-in server
```

## Test routes

| Route | Description |
|-------|-------------|
| `GET /` | Lists available routes |
| `GET /error` | Throws a `RuntimeException` — captured automatically by the bundle |
| `GET /message` | Manually sends a warning event via `ErrorSenderInterface` |
| `GET /breadcrumb` | Adds 4 breadcrumbs then throws — error arrives with full trail attached |

```bash
# Quick smoke-test
curl http://localhost:8080/
curl http://localhost:8080/message
curl http://localhost:8080/breadcrumb  # will return a 500 — check the ErrorWatch dashboard
```

## How it works

The bundle registers an `ExceptionSubscriber` on the `kernel.exception` event. Any uncaught exception is automatically:

1. Fingerprinted and deduplicated by the monitoring server
2. Enriched with breadcrumbs collected during the request lifetime
3. Enriched with user context (when Symfony Security is available)
4. Sent asynchronously to the ErrorWatch API

For manual reporting, inject `ErrorWatch\Symfony\Service\ErrorSenderInterface` and call `send()`.

## Configuration reference

See `config/packages/errorwatch.yaml` for all available options. Full documentation is in the bundle's own README at `packages/sdk-symfony/README.md`.
