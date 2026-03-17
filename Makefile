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
			END {print "\n$(YELLOW)DEVELOPMENT:$(RESET)" dev "\n\n$(YELLOW)INFRASTRUCTURE:$(RESET)" infra "\n\n$(YELLOW)EXAMPLES:$(RESET)" ex "\n\n$(YELLOW)PRODUCTION:$(RESET)" prod}'

# =============================================================================
# DEVELOPMENT
# =============================================================================

install: ## Install all dependencies
	@echo "$(GREEN)Installing dependencies...$(RESET)"
	@bun install
	@test -f .env || (echo "POSTGRES_PASSWORD=errorwatch_dev_password" > .env && echo "$(YELLOW)Created .env with default Docker credentials$(RESET)")
	@test -f apps/api/.env || (cp apps/api/.env.example apps/api/.env && echo "$(YELLOW)Created apps/api/.env from .env.example — edit it with your values$(RESET)")
	@test -f apps/web/.env.local || (cp apps/web/.env.local.example apps/web/.env.local 2>/dev/null && echo "$(YELLOW)Created apps/web/.env.local from example$(RESET)" || true)

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

prod-deploy: ## Full deploy (pull + build + migrate)
	@chmod +x deploy/deploy.sh
	@deploy/deploy.sh

# =============================================================================
# EXAMPLES
# =============================================================================

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
