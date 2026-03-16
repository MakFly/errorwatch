#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# ErrorWatch - deploy.sh
# ----------------------------------------------------------------------------
# Full-Docker deployment script.
#
# First deployment on a fresh server:
#   deploy/first-init-deploy.sh .env.production
#
# Regular updates:
#   deploy/deploy.sh .env.production
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/_common.sh
source "${SCRIPT_DIR}/_common.sh"

SKIP_PULL=0
ENV_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pull)
      SKIP_PULL=1
      shift
      ;;
    -h|--help)
      cat <<'USAGE'
Usage:
  deploy/deploy.sh [--skip-pull] [path-to-env-file]

When to use:
  - Existing production install (update/redeploy)
  - Not for first server bootstrap

Examples:
  deploy/deploy.sh .env.production
  deploy/deploy.sh --skip-pull .env.production

Default env file resolution order:
  .env.production -> .env.prod -> .env
USAGE
      exit 0
      ;;
    *)
      ENV_ARG="$1"
      shift
      ;;
  esac
done

ENV_FILE="$(resolve_env_file "${ENV_ARG}")" || {
  echo "[ERROR] No env file found. Provide one or create .env.production / .env.prod / .env"
  exit 1
}

cd "$PROJECT_ROOT"

load_env_file "$ENV_FILE"
validate_required_env "$ENV_FILE"

if [[ "$SKIP_PULL" -eq 0 ]]; then
  echo "[1/6] Pull latest code"
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "[ERROR] Working tree is dirty. Commit/stash local changes before deploy."
    git status --short
    exit 1
  fi

  DEPLOY_BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
  git fetch origin "$DEPLOY_BRANCH"
  git pull --ff-only origin "$DEPLOY_BRANCH"
else
  echo "[1/6] Skip git pull (--skip-pull)"
fi

echo "[2/6] Build and start all services"
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml up -d --build

echo "[3/6] Wait for services to be healthy"
wait_for_healthy "errorwatch-postgres" 90
wait_for_healthy "errorwatch-redis" 60
wait_for_healthy "errorwatch-api" 120
wait_for_healthy "errorwatch-web" 120

echo "[4/6] Run database migrations"
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml exec -T api bun run db:push

echo "[5/6] Health checks"
run_health_checks

echo "[6/6] Service status"
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml ps

echo "[SUCCESS] Deployment completed."
