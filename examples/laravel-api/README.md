# ErrorWatch — Laravel API Example

A complete Laravel 12 REST API example showcasing [ErrorWatch](https://errorwatch.io) SDK integration. This project implements a Task Manager API with Sanctum token authentication, tags, filtering, and automatic error/APM reporting to ErrorWatch.

## What this demonstrates

- **Exception capture** — unhandled exceptions are automatically sent to ErrorWatch
- **Query tracing** — Eloquent queries are tracked (N+1 detection included)
- **Breadcrumbs** — HTTP requests, SQL queries, auth events are recorded automatically
- **Log integration** — `Log::warning()`, `Log::error()` etc. appear in ErrorWatch
- **User context** — authenticated user is attached to every event
- **Test routes** — `/api/v1/test/error` and `/api/v1/test/warning` let you trigger events instantly

## Prerequisites

- PHP 8.2+
- Composer
- SQLite (built into PHP — no separate install needed)

## Setup

```bash
# 1. Install dependencies
composer install

# 2. Copy environment file
cp .env.example .env

# 3. Generate app key
php artisan key:generate

# 4. Create SQLite database and run migrations with seed data
touch database/database.sqlite
php artisan migrate --seed

# 5. Start the development server
php artisan serve
```

The API will be available at `http://localhost:8000`.

## ErrorWatch configuration

Edit `.env` with your ErrorWatch project credentials:

```env
ERRORWATCH_ENABLED=true
ERRORWATCH_ENDPOINT=http://localhost:3333   # or https://api.errorwatch.io
ERRORWATCH_API_KEY=your-project-api-key
```

Publish the config if you need to customise it further:

```bash
php artisan vendor:publish --tag=errorwatch-config
```

## Seed credentials

After running `php artisan migrate --seed`, two users are created:

| Name | Email | Password |
|------|-------|----------|
| Test User | test@example.com | password |
| Demo User | demo@errorwatch.io | password |

The Demo User has 20 tasks with random statuses/priorities and 5 tags pre-assigned.

## API endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/register` | Register a new user |
| POST | `/api/v1/login` | Login and get Sanctum token |
| POST | `/api/v1/logout` | Revoke current token (auth required) |
| GET | `/api/v1/me` | Get current user (auth required) |

### Tasks (auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tasks` | List tasks (filter: `?status=pending&priority=high`) |
| POST | `/api/v1/tasks` | Create a task |
| GET | `/api/v1/tasks/{id}` | Get a task |
| PUT/PATCH | `/api/v1/tasks/{id}` | Update a task |
| DELETE | `/api/v1/tasks/{id}` | Delete a task |
| POST | `/api/v1/tasks/{id}/tags` | Attach tags (`{"tag_ids": [1, 2]}`) |
| DELETE | `/api/v1/tasks/{id}/tags` | Detach tags (`{"tag_ids": [1]}`) |

### Tags (auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tags` | List all tags |
| POST | `/api/v1/tags` | Create a tag |
| GET | `/api/v1/tags/{id}` | Get a tag |
| PUT/PATCH | `/api/v1/tags/{id}` | Update a tag |
| DELETE | `/api/v1/tags/{id}` | Delete a tag |

### ErrorWatch test routes (public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/test/error` | Throws a RuntimeException → captured by ErrorWatch |
| GET | `/api/v1/test/warning` | Logs a warning → sent to ErrorWatch |
| GET | `/api/v1/test/divide-by-zero` | Division by zero error |

## Quick test with curl

```bash
# Register
curl -s -X POST http://localhost:8000/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"password","password_confirmation":"password"}' | jq

# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' | jq -r '.token')

# List tasks
curl -s http://localhost:8000/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" | jq

# Create a task
curl -s -X POST http://localhost:8000/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My first task","priority":"high","status":"pending"}' | jq

# Trigger an error (captured by ErrorWatch)
curl -s http://localhost:8000/api/v1/test/error
```

## Task model fields

| Field | Type | Values |
|-------|------|--------|
| `title` | string | required |
| `description` | text | optional |
| `status` | enum | `pending`, `in_progress`, `done` |
| `priority` | enum | `low`, `medium`, `high` |
| `due_date` | date | optional, format `Y-m-d` |

## Project structure

```
app/
├── Enums/
│   ├── TaskPriority.php
│   └── TaskStatus.php
├── Http/
│   ├── Controllers/Api/V1/
│   │   ├── AuthController.php
│   │   ├── TagController.php
│   │   └── TaskController.php
│   ├── Requests/
│   │   ├── StoreTagRequest.php
│   │   ├── StoreTaskRequest.php
│   │   ├── UpdateTagRequest.php
│   │   └── UpdateTaskRequest.php
│   └── Resources/
│       ├── TagResource.php
│       ├── TaskCollection.php
│       └── TaskResource.php
├── Models/
│   ├── Tag.php
│   ├── Task.php
│   └── User.php
config/
└── errorwatch.php   # ErrorWatch SDK configuration
routes/
└── api.php          # All API routes under /api/v1/
```
