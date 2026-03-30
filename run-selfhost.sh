#!/usr/bin/env bash
set -euo pipefail

# ===========================================
# ErrorWatch Self-Host Manager
# ===========================================

COMPOSE_FILE="docker-compose.selfhost.yml"
COMPOSE="docker compose -f $COMPOSE_FILE"
APP_SERVICES="api web"
INFRA_SERVICES="postgres redis"
ALL_SERVICES="$INFRA_SERVICES $APP_SERVICES caddy"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# Ensure we run from the script's directory
cd "$(dirname "$0")"

check_env() {
    if [ ! -f .env ]; then
        error ".env file not found."
        echo "  cp .env.selfhost.example .env"
        echo "  Then fill in the required values."
        exit 1
    fi
}

wait_healthy() {
    local container="$1"
    local timeout="${2:-90}"
    local elapsed=0

    info "Waiting for $container to be healthy..."
    while [ $elapsed -lt $timeout ]; do
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not found")
        case "$health" in
            healthy)   ok "$container is healthy"; return 0 ;;
            unhealthy) error "$container is unhealthy"; docker logs --tail 10 "$container"; return 1 ;;
        esac
        sleep 3
        elapsed=$((elapsed + 3))
    done
    error "$container did not become healthy within ${timeout}s"
    docker logs --tail 20 "$container"
    return 1
}

cmd_up() {
    check_env
    info "Starting ErrorWatch stack..."
    $COMPOSE up -d "$@"
    ok "Stack started."
    cmd_status
}

cmd_down() {
    info "Stopping ErrorWatch stack..."
    $COMPOSE down "$@"
    ok "Stack stopped."
}

cmd_pull() {
    check_env
    info "Pulling latest images..."
    $COMPOSE pull api web
    ok "Images pulled."
}

cmd_deploy() {
    check_env

    info "=== ErrorWatch Deploy ==="
    echo

    # 1. Pull latest app images
    info "Step 1/4: Pulling latest images..."
    $COMPOSE pull api web
    ok "Images pulled."
    echo

    # 2. Recreate only app containers (zero-downtime for infra)
    info "Step 2/4: Recreating app containers..."
    $COMPOSE up -d --no-deps --force-recreate api
    wait_healthy errorwatch-api

    $COMPOSE up -d --no-deps --force-recreate web
    wait_healthy errorwatch-web
    echo

    # 3. Reload Caddy if running
    if docker ps --format '{{.Names}}' | grep -q errorwatch-caddy; then
        info "Step 3/4: Reloading Caddy..."
        $COMPOSE up -d --no-deps --force-recreate caddy
        ok "Caddy reloaded."
    else
        info "Step 3/4: Caddy not running, skipping."
    fi
    echo

    # 4. Cleanup old images
    info "Step 4/4: Cleaning up old images..."
    docker image prune -f --filter "label=org.opencontainers.image.vendor=ErrorWatch" 2>/dev/null || true
    ok "Cleanup done."
    echo

    ok "=== Deploy complete ==="
    cmd_status
}

cmd_status() {
    echo
    docker ps --filter "name=errorwatch" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo
}

cmd_logs() {
    local service="${1:-}"
    if [ -n "$service" ]; then
        shift
        $COMPOSE logs -f "$service" "$@"
    else
        $COMPOSE logs -f --tail 100
    fi
}

cmd_health() {
    check_env
    echo
    local all_ok=true

    for container in errorwatch-postgres errorwatch-redis errorwatch-api errorwatch-web; do
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not running")
        case "$health" in
            healthy)     echo -e "  ${GREEN}✓${NC} $container" ;;
            not\ running) echo -e "  ${YELLOW}–${NC} $container (not running)"; all_ok=false ;;
            *)           echo -e "  ${RED}✗${NC} $container ($health)"; all_ok=false ;;
        esac
    done

    echo
    if [ "$all_ok" = true ]; then
        ok "All services healthy."
    else
        warn "Some services are not healthy."
        return 1
    fi
}

cmd_version() {
    echo
    for service in api web; do
        local image
        image=$(docker inspect --format='{{.Config.Image}}' "errorwatch-$service" 2>/dev/null || echo "not running")
        local digest
        digest=$(docker inspect --format='{{.Image}}' "errorwatch-$service" 2>/dev/null | cut -c8-19 || echo "n/a")
        echo -e "  $service: ${CYAN}$image${NC} (${digest})"
    done
    echo
}

cmd_backup_db() {
    check_env
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="backup_errorwatch_${timestamp}.sql.gz"

    info "Backing up database to $backup_file..."
    docker exec errorwatch-postgres pg_dump -U "${POSTGRES_USER:-errorwatch}" "${POSTGRES_DB:-errorwatch}" \
        | gzip > "$backup_file"
    ok "Backup saved: $backup_file ($(du -h "$backup_file" | cut -f1))"
}

cmd_database() {
    check_env
    local action="${1:-}"
    local db_user="${POSTGRES_USER:-errorwatch}"
    local db_name="${POSTGRES_DB:-errorwatch}"

    case "$action" in
        --create)
            info "Creating database schema via drizzle-kit push..."
            docker exec errorwatch-api bunx drizzle-kit push
            ok "Database schema created."
            ;;
        --reset)
            warn "This will DROP and recreate the database '$db_name'. All data will be lost!"
            read -rp "Are you sure? (y/N) " confirm
            if [[ "$confirm" != [yY] ]]; then
                info "Aborted."
                return 0
            fi
            info "Stopping API..."
            $COMPOSE stop api
            info "Dropping database '$db_name'..."
            docker exec errorwatch-postgres psql -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS \"$db_name\";"
            info "Recreating database '$db_name'..."
            docker exec errorwatch-postgres psql -U "$db_user" -d postgres -c "CREATE DATABASE \"$db_name\" OWNER \"$db_user\";"
            ok "Database recreated."
            info "Starting API (entrypoint will push schema automatically)..."
            $COMPOSE up -d api
            wait_healthy errorwatch-api
            ok "Database reset complete."
            ;;
        --update)
            info "Updating database schema via drizzle-kit push..."
            docker exec errorwatch-api bunx drizzle-kit push
            ok "Database schema updated."
            ;;
        *)
            error "Usage: ./run-selfhost.sh database <--create|--reset|--update>"
            echo
            echo "  --create   Initialize the database schema (first setup)"
            echo "  --reset    Drop and recreate the database (⚠ destroys all data)"
            echo "  --update   Push latest schema changes (safe, additive)"
            return 1
            ;;
    esac
}

usage() {
    cat <<USAGE
${CYAN}ErrorWatch Self-Host Manager${NC}

Usage: ./run-selfhost.sh <command> [options]

${GREEN}Commands:${NC}
  up [services...]     Start the full stack (or specific services)
  down                 Stop the full stack
  deploy               Pull latest images & redeploy app (zero-downtime for DB)
  pull                 Pull latest app images without restarting
  status               Show container status
  health               Check healthchecks for all services
  version              Show running image versions
  logs [service]       Tail logs (all or specific service: api, web, postgres, redis, caddy)
  backup-db            Dump PostgreSQL to a timestamped .sql.gz file
  database <action>    Manage database (--create, --reset, --update)

${YELLOW}Examples:${NC}
  ./run-selfhost.sh up                    # Start everything
  ./run-selfhost.sh up postgres redis     # Start infra only
  ./run-selfhost.sh deploy                # Update to latest release
  ./run-selfhost.sh logs api              # Tail API logs
  ./run-selfhost.sh backup-db             # Backup database
  ./run-selfhost.sh database --create     # Initialize DB schema
  ./run-selfhost.sh database --reset      # Reset DB (drops all data)
  ./run-selfhost.sh database --update     # Apply schema changes

USAGE
}

case "${1:-}" in
    up)         shift; cmd_up "$@" ;;
    down)       shift; cmd_down "$@" ;;
    deploy)     cmd_deploy ;;
    pull)       cmd_pull ;;
    status)     cmd_status ;;
    health)     cmd_health ;;
    version)    cmd_version ;;
    logs)       shift; cmd_logs "$@" ;;
    backup-db)  cmd_backup_db ;;
    database)   shift; cmd_database "$@" ;;
    -h|--help|help|"") usage ;;
    *)          error "Unknown command: $1"; usage; exit 1 ;;
esac
