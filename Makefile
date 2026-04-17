# ErrorWatch Makefile
# ===================

# Colors
GREEN  := \033[0;32m
YELLOW := \033[0;33m
CYAN   := \033[0;36m
RED    := \033[0;31m
RESET  := \033[0m

# Docker Compose files
COMPOSE_DEV := docker-compose.yml
COMPOSE_PROD := docker-compose.prod.yml

# PostgreSQL credentials (prod)
POSTGRES_USER := errorwatch
POSTGRES_DB := errorwatch

# Postgres password is read from .env by Docker Compose

.PHONY: help

help: ## Show this help
	@echo "$(CYAN)ErrorWatch Makefile$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; \
			/^(install|build|clean|dev|start|stop|status)/ {dev=dev"\n  $(CYAN)" $$1 "$(RESET)\t" $$2} \
			/^infra-|^db-|^redis-/ {infra=infra"\n  $(CYAN)" $$1 "$(RESET)\t" $$2} \
			/^prod-/ {prod=prod"\n  $(CYAN)" $$1 "$(RESET)\t" $$2} \
			/^example-/ {ex=ex"\n  $(CYAN)" $$1 "$(RESET)\t" $$2} \
			/^sdk-/ {sdk=sdk"\n  $(CYAN)" $$1 "$(RESET)\t" $$2} \
			END {print "\n$(YELLOW)DEVELOPMENT:$(RESET)" dev "\n\n$(YELLOW)INFRASTRUCTURE:$(RESET)" infra "\n\n$(YELLOW)SDKs (worktree layout):$(RESET)" sdk "\n\n$(YELLOW)EXAMPLES:$(RESET)" ex "\n\n$(YELLOW)PRODUCTION:$(RESET)" prod}'

# =============================================================================
# DEVELOPMENT
# =============================================================================

install: ## Full local setup: deps, .env + secrets, infra, DB schema
	@command -v bun >/dev/null 2>&1 || { echo "$(RED)bun not found — install from https://bun.sh$(RESET)"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "$(RED)docker not found$(RESET)"; exit 1; }
	@echo "$(GREEN)Installing dependencies...$(RESET)"
	@bun install
	@echo "$(GREEN)Setting up local environment...$(RESET)"
	@$(MAKE) env-setup
	@echo "$(GREEN)Starting infrastructure...$(RESET)"
	@$(MAKE) infra-up
	@$(MAKE) infra-wait
	@echo "$(GREEN)Pushing database schema...$(RESET)"
	@$(MAKE) db-push
	@echo ""
	@echo "$(GREEN)✓ Install complete.$(RESET) Run $(CYAN)make dev$(RESET) to start API + Web."

env-setup: ## Create .env and generate any missing local secrets
	@chmod +x scripts/setup-env.sh
	@./scripts/setup-env.sh

build: ## Build all apps for production
	@echo "$(GREEN)Building applications...$(RESET)"
	@bunx turbo run build

clean: ## Clean build artifacts
	@echo "$(YELLOW)Cleaning...$(RESET)"
	@rm -rf apps/web/.next
	@rm -rf apps/api/dist

dev: infra-up infra-wait db-push ## Start infra + API + Web concurrently
	@echo "$(GREEN)Starting API (3333) + Web (4001)...$(RESET)"
	@bun run dev

dev-api: ## Start API server only (port 3333)
	@cd apps/api && bun run dev:standalone

dev-web: ## Start web dashboard only (port 4001)
	@cd apps/web && bun run dev:standalone

start: dev ## Alias for dev

stop: ## Stop all dev processes
	@echo "$(YELLOW)Stopping dev processes...$(RESET)"
	@pkill -f "tsx.*src/index.ts" 2>/dev/null || true
	@pkill -f "next dev" 2>/dev/null || true
	@echo "$(GREEN)Done$(RESET)"

status: ## Check dev services
	@echo "$(CYAN)=== Dev Status ===$(RESET)"
	@curl -s -o /dev/null -w "Dashboard:   HTTP %{http_code}\n" http://localhost:4001 2>/dev/null || echo "Dashboard:   $(RED)Not running$(RESET)"
	@curl -s -o /dev/null -w "API Server:  HTTP %{http_code}\n" http://localhost:3333/health 2>/dev/null || echo "API Server:  $(RED)Not running$(RESET)"
	@echo ""
	@$(MAKE) infra-check

# =============================================================================
# INFRASTRUCTURE (Docker)
# =============================================================================

infra-up: ## Start Docker infra (postgres + redis)
	@echo "$(GREEN)Starting infrastructure...$(RESET)"
	@docker compose -f $(COMPOSE_DEV) up -d postgres redis

infra-wait: ## Wait for postgres + redis to be healthy
	@echo "$(CYAN)Waiting for PostgreSQL...$(RESET)"
	@until docker compose -f $(COMPOSE_DEV) exec -T postgres pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1; do sleep 1; done
	@echo "$(CYAN)Waiting for Redis...$(RESET)"
	@until docker compose -f $(COMPOSE_DEV) exec -T redis redis-cli ping >/dev/null 2>&1; do sleep 1; done
	@echo "$(GREEN)Infrastructure ready$(RESET)"

infra-down: ## Stop Docker infra
	@echo "$(YELLOW)Stopping infrastructure...$(RESET)"
	@docker compose -f $(COMPOSE_DEV) down

infra-check: ## Check infra status
	@echo "$(CYAN)Infra:$(RESET)"
	@docker compose -f $(COMPOSE_DEV) ps postgres redis 2>/dev/null || echo "  $(RED)No infra running$(RESET)"

# =============================================================================
# DATABASE
# =============================================================================

db-create: ## Create database (dev)
	@docker compose -f $(COMPOSE_DEV) exec postgres psql -U $(POSTGRES_USER) -tc \
		"SELECT 1 FROM pg_database WHERE datname = '$(POSTGRES_DB)'" | grep -q 1 || \
		docker compose -f $(COMPOSE_DEV) exec postgres psql -U $(POSTGRES_USER) -c "CREATE DATABASE $(POSTGRES_DB);"

db-push: ## Push schema to database
	@cd apps/api && bun run db:push

db-migrate: ## Run migrations
	@cd apps/api && bun run db:migrate

db-seed: ## Seed database (dev user: dev@test.com / password123)
	@echo "$(GREEN)Seeding database...$(RESET)"
	@cd apps/api && bun run seed

db-reset: ## Reset database (destructive!)
	@echo "$(RED)Resetting database...$(RESET)"
	@docker compose -f $(COMPOSE_DEV) exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true
	@$(MAKE) db-push

# =============================================================================
# REDIS
# =============================================================================

redis-cli: ## Open Redis CLI (dev)
	@docker compose -f $(COMPOSE_DEV) exec redis redis-cli

# =============================================================================
# PRODUCTION (Full Docker)
# =============================================================================

prod-up: ## Build and start production stack
	@echo "$(GREEN)Starting production stack...$(RESET)"
	@docker compose -f $(COMPOSE_PROD) up -d --build

prod-down: ## Stop production stack
	@echo "$(YELLOW)Stopping production stack...$(RESET)"
	@docker compose -f $(COMPOSE_PROD) down

prod-restart: ## Restart production stack
	@$(MAKE) prod-down
	@$(MAKE) prod-up

prod-status: ## Check production status
	@docker compose -f $(COMPOSE_PROD) ps

prod-logs: ## Show production logs
	@docker compose -f $(COMPOSE_PROD) logs -f

prod-logs-api: ## Show API logs
	@docker compose -f $(COMPOSE_PROD) logs -f api

prod-logs-web: ## Show dashboard logs
	@docker compose -f $(COMPOSE_PROD) logs -f web

prod-db-push: ## Run migrations in production (via Docker exec)
	@echo "$(GREEN)Running migrations...$(RESET)"
	@docker compose -f $(COMPOSE_PROD) exec api bun run db:push

prod-db-shell: ## Open PostgreSQL shell (production)
	@docker compose -f $(COMPOSE_PROD) exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

# =============================================================================
# SDK — unified PHP package (Symfony + Laravel) — worktree layout
#   Shared bare clone:        .git-bare/errorwatch-sdk-php.git
#   Default-branch worktree:  packages/errorwatch-sdk-php
#   Feature worktree:         packages/errorwatch-sdk-php-<branch>
# =============================================================================

SDK_WT := ./scripts/sdk-worktree.sh
SDK_PHP_URL ?= git@github.com:MakFly/errorwatch-sdk-php.git
SDK_PHP_DIR := packages/errorwatch-sdk-php

sdk-php-init: ## Clone the SDK (bare) + default-branch worktree at packages/errorwatch-sdk-php
	@$(SDK_WT) init errorwatch-sdk-php $(SDK_PHP_URL)

sdk-php-convert: ## Convert an existing normal clone to the worktree layout (idempotent, preserves uncommitted changes)
	@$(SDK_WT) convert errorwatch-sdk-php

sdk-php-wt: ## Add a feature-branch worktree (usage: make sdk-php-wt BRANCH=feat-x)
	@test -n "$(BRANCH)" || (echo "$(RED)BRANCH variable required: make sdk-php-wt BRANCH=feat-x$(RESET)"; exit 2)
	@$(SDK_WT) add errorwatch-sdk-php $(BRANCH)

sdk-php-list: ## List SDK worktrees
	@$(SDK_WT) list errorwatch-sdk-php

sdk-php-install: ## Install composer deps inside the SDK
	@cd $(SDK_PHP_DIR) && composer install --no-progress

sdk-php-test: ## Run PHPUnit inside the SDK (core + symfony)
	@cd $(SDK_PHP_DIR) && vendor/bin/phpunit --testsuite=core,symfony

sdk-php-test-all: ## Run PHPUnit all suites (core + symfony + laravel)
	@cd $(SDK_PHP_DIR) && vendor/bin/phpunit

sdk-php-stan: ## Run PHPStan inside the SDK
	@cd $(SDK_PHP_DIR) && vendor/bin/phpstan analyse --no-progress

# =============================================================================
# EXAMPLES
# =============================================================================

# -------- Laravel --------
example-laravel-setup: ## Setup Laravel example (auth + API key + deps)
	@chmod +x scripts/setup-laravel-example.sh
	@./scripts/setup-laravel-example.sh

example-laravel-start: ## Start Laravel example on port 8008
	@echo "$(GREEN)Starting Laravel example on http://localhost:8008...$(RESET)"
	@cd examples/laravel-api && php artisan serve --port=8008

example-laravel-log: ## Write a test line via Laravel logger so ErrorWatch ingests it
	@cd examples/laravel-api && php artisan tinker --execute="logger()->warning('makefile test log', ['source' => 'makefile']);"

example-laravel: example-laravel-setup example-laravel-start ## Setup + start Laravel example

example-laravel-test: ## Send test errors to ErrorWatch from Laravel
	@echo "$(CYAN)Sending test errors...$(RESET)"
	@echo ""
	@echo "$(YELLOW)1. RuntimeException:$(RESET)"
	@curl -s http://localhost:8008/api/v1/test/error 2>/dev/null && echo "" || echo "$(RED)  Server not running. Run: make example-laravel-start$(RESET)"
	@echo ""
	@echo "$(YELLOW)2. Warning log:$(RESET)"
	@curl -s http://localhost:8008/api/v1/test/warning 2>/dev/null && echo "" || true
	@echo ""
	@echo "$(YELLOW)3. Division by zero:$(RESET)"
	@curl -s http://localhost:8008/api/v1/test/divide-by-zero 2>/dev/null && echo "" || true
	@echo ""
	@echo "$(GREEN)Check your ErrorWatch dashboard for incoming errors.$(RESET)"

# -------- Symfony --------
EXAMPLE_SYMFONY := examples/example-symfony
EXAMPLE_SYMFONY_PORT := 8088
EXAMPLE_SYMFONY_PID := $(EXAMPLE_SYMFONY)/var/run.pid

example-symfony-setup: ## Install composer deps + generate .env if missing
	@command -v php >/dev/null 2>&1 || { echo "$(RED)php not found — install PHP 8.1+$(RESET)"; exit 1; }
	@command -v composer >/dev/null 2>&1 || { echo "$(RED)composer not found$(RESET)"; exit 1; }
	@test -d $(SDK_PHP_DIR) || { echo "$(YELLOW)$(SDK_PHP_DIR) missing — running sdk-php-init$(RESET)"; $(MAKE) sdk-php-init; }
	@test -f $(EXAMPLE_SYMFONY)/.env || cp $(EXAMPLE_SYMFONY)/.env.example $(EXAMPLE_SYMFONY)/.env
	@echo "$(GREEN)Installing composer deps...$(RESET)"
	@cd $(EXAMPLE_SYMFONY) && composer install --no-interaction --prefer-dist
	@echo "$(GREEN)✓ Setup complete.$(RESET) Edit $(EXAMPLE_SYMFONY)/.env with your ERRORWATCH_API_KEY, then $(CYAN)make example-symfony-start$(RESET)"

example-symfony-start: ## Start Symfony dev server on :8088 (foreground)
	@echo "$(GREEN)Starting Symfony example on http://localhost:$(EXAMPLE_SYMFONY_PORT)...$(RESET)"
	@cd $(EXAMPLE_SYMFONY) && php -S 0.0.0.0:$(EXAMPLE_SYMFONY_PORT) -t public public/index.php

example-symfony-start-bg: ## Start Symfony dev server in background (PID in var/run.pid)
	@mkdir -p $(EXAMPLE_SYMFONY)/var
	@test ! -f $(EXAMPLE_SYMFONY_PID) || { echo "$(YELLOW)Already running (PID $$(cat $(EXAMPLE_SYMFONY_PID))). Run make example-symfony-stop first.$(RESET)"; exit 0; }
	@cd $(EXAMPLE_SYMFONY) && (php -S 0.0.0.0:$(EXAMPLE_SYMFONY_PORT) -t public public/index.php > var/server.log 2>&1 & echo $$! > var/run.pid)
	@sleep 1
	@echo "$(GREEN)Started (PID $$(cat $(EXAMPLE_SYMFONY_PID)))$(RESET) — logs: $(EXAMPLE_SYMFONY)/var/server.log"

example-symfony-stop: ## Stop the background Symfony dev server
	@test -f $(EXAMPLE_SYMFONY_PID) || { echo "$(YELLOW)Not running$(RESET)"; exit 0; }
	@PID=$$(cat $(EXAMPLE_SYMFONY_PID)); kill $$PID 2>/dev/null && echo "$(GREEN)Stopped PID $$PID$(RESET)" || echo "$(YELLOW)Process already gone$(RESET)"
	@rm -f $(EXAMPLE_SYMFONY_PID)

example-symfony-reset: ## Remove vendor + var/cache + composer.lock (destructive)
	@echo "$(RED)Resetting $(EXAMPLE_SYMFONY)...$(RESET)"
	@$(MAKE) example-symfony-stop >/dev/null 2>&1 || true
	@rm -rf $(EXAMPLE_SYMFONY)/vendor $(EXAMPLE_SYMFONY)/var $(EXAMPLE_SYMFONY)/composer.lock
	@echo "$(GREEN)✓ Reset done. Run 'make example-symfony-setup' to reinstall.$(RESET)"

example-symfony-trigger: ## Hit every /trigger/* endpoint to generate errors, spans, cache ops, logs, db queries
	@echo "$(CYAN)Hitting trigger routes on :$(EXAMPLE_SYMFONY_PORT)...$(RESET)"
	@for flavour in runtime type logic; do \
		printf "  $(YELLOW)→ /trigger/error?flavour=%s$(RESET)  " "$$flavour"; \
		curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:$(EXAMPLE_SYMFONY_PORT)/trigger/error?flavour=$$flavour" || echo "$(RED)down$(RESET)"; \
	done
	@for route in http-call cache log slow-query db-list db-n-plus-one; do \
		printf "  $(YELLOW)→ /trigger/%s$(RESET)  " "$$route"; \
		curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:$(EXAMPLE_SYMFONY_PORT)/trigger/$$route || echo "$(RED)down$(RESET)"; \
	done
	@echo "$(GREEN)Check your ErrorWatch dashboard.$(RESET)"

example-symfony-cron: ## Fire the demo cron command to populate /crons
	@echo "$(CYAN)Running app:cron:demo 5 times...$(RESET)"
	@cd $(EXAMPLE_SYMFONY) && for i in 1 2 3 4 5; do php bin/console app:cron:demo --quiet || true; done
	@echo "$(GREEN)✓ Cron check-ins sent.$(RESET)"

example-symfony-setup-db: ## Initialise the SQLite Doctrine schema + sample data
	@cd $(EXAMPLE_SYMFONY) && php bin/console app:setup-db

example-symfony-trigger-all: example-symfony-setup-db example-symfony-trigger example-symfony-cron ## One-shot: seed DB, hit every trigger, fire cron

example-symfony: example-symfony-setup example-symfony-start ## Setup + start Symfony example (foreground)

example-symfony-logs: ## Tail the Symfony dev server log
	@tail -f $(EXAMPLE_SYMFONY)/var/server.log
