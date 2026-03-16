# ErrorWatch — Laravel Example

Minimal Laravel 11/12 application demonstrating the [ErrorWatch Laravel SDK](../../packages/sdk-laravel/README.md).

## Prerequisites

- PHP 8.1+
- Composer
- An ErrorWatch monitoring server running on `http://localhost:3333` (see root `README.md`)

## Setup

```bash
# 1. Install dependencies (path repository resolves to ../../packages/sdk-laravel)
composer install

# 2. Copy the environment file
cp .env.example .env

# 3. Generate the application key
php artisan key:generate

# 4. (Optional) Create the SQLite database if you need sessions/cache
touch database/database.sqlite
php artisan migrate --graceful
```

Edit `.env` and set your actual values:

```dotenv
ERRORWATCH_ENDPOINT=http://localhost:3333
ERRORWATCH_API_KEY=ew_your_project_api_key
```

## Run

```bash
php artisan serve
# → http://localhost:8000
```

## Available Routes

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/` | SDK status and route list |
| `GET` | `/error` | Throws `RuntimeException` — captured automatically |
| `GET` | `/message` | Sends a manual message via `ErrorWatch::captureMessage()` |
| `GET` | `/breadcrumb` | Adds breadcrumbs then throws — check the breadcrumb trail in the dashboard |

## Artisan Command

```bash
# Throw a test exception
php artisan errorwatch:test

# Send a test message (no exception)
php artisan errorwatch:test --message

# Add breadcrumbs then throw
php artisan errorwatch:test --breadcrumb
```

## How the SDK Is Wired

The SDK uses **Laravel package auto-discovery** — no manual registration needed.

The `composer.json` of `errorwatch/sdk-laravel` declares:

```json
"extra": {
    "laravel": {
        "providers": ["ErrorWatch\\Laravel\\ErrorWatchServiceProvider"],
        "aliases": { "ErrorWatch": "ErrorWatch\\Laravel\\Facades\\ErrorWatch" }
    }
}
```

The `ErrorWatchServiceProvider` then:

1. Registers `MonitoringClient` as a singleton (reads `config/errorwatch.php`).
2. Pushes `ErrorWatchMiddleware` to the `web` and `api` middleware groups (Laravel 11+).
3. Extends `ExceptionHandler` to forward uncaught exceptions to the monitoring server.
4. Registers listeners for Eloquent queries, queue jobs, HTTP client calls, log messages, and security events.

## Configuration

`config/errorwatch.php` — published copy of the SDK default config. Key values:

| Key | Env var | Default |
|-----|---------|---------|
| `enabled` | `ERRORWATCH_ENABLED` | `true` |
| `endpoint` | `ERRORWATCH_ENDPOINT` | _(required)_ |
| `api_key` | `ERRORWATCH_API_KEY` | _(required)_ |
| `exceptions.enabled` | `ERRORWATCH_EXCEPTIONS_ENABLED` | `true` |
| `logging.enabled` | `ERRORWATCH_LOGGING_ENABLED` | `true` |
| `logging.level` | `ERRORWATCH_LOG_LEVEL` | `error` |

Publish to your own app with:

```bash
php artisan vendor:publish --tag=errorwatch-config
```
