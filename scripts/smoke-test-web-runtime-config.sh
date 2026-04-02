#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:?Usage: $0 <docker-image>}"
PORT="${PORT:-3300}"
CONTAINER="errorwatch-web-runtime-smoke"
TARGET_URL="http://127.0.0.1:${PORT}/login"
EXPECTED_APP_URL="https://error-watch.tilvest.com"
EXPECTED_API_URL="https://api.error-watch.tilvest.com"
RUNTIME_CONFIG_PATH="/api/runtime-config"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}

trap cleanup EXIT

cleanup

docker run -d \
  --name "$CONTAINER" \
  -p "127.0.0.1:${PORT}:3000" \
  -e SELF_HOSTED=true \
  -e AUTH_FAIL_OPEN=true \
  -e NODE_ENV=production \
  -e HOSTNAME=0.0.0.0 \
  -e PORT=3000 \
  -e INTERNAL_API_URL=http://api:3333 \
  -e API_URL="$EXPECTED_API_URL" \
  -e DASHBOARD_URL="$EXPECTED_APP_URL" \
  -e BETTER_AUTH_URL="$EXPECTED_API_URL" \
  -e NEXT_PUBLIC_ENABLE_SSO=true \
  "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS "$TARGET_URL" >/tmp/errorwatch-runtime-config-smoke.html 2>/dev/null; then
    break
  fi
  sleep 1
done

HTML="$(cat /tmp/errorwatch-runtime-config-smoke.html)"

if [[ "$HTML" == *"http://localhost:3333"* ]] || [[ "$HTML" == *"http://localhost:4001"* ]]; then
  echo "Login HTML still contains localhost fallback URLs." >&2
  exit 1
fi

if [[ "$HTML" != *"$RUNTIME_CONFIG_PATH"* ]]; then
  echo "Login HTML does not load the runtime config endpoint." >&2
  exit 1
fi

RUNTIME_CONFIG="$(curl -fsS "http://127.0.0.1:${PORT}${RUNTIME_CONFIG_PATH}")"

if [[ "$RUNTIME_CONFIG" == *"http://localhost:3333"* ]] || [[ "$RUNTIME_CONFIG" == *"http://localhost:4001"* ]]; then
  echo "Runtime config endpoint still contains localhost fallback URLs." >&2
  exit 1
fi

if [[ "$RUNTIME_CONFIG" != *"$EXPECTED_APP_URL"* ]] || [[ "$RUNTIME_CONFIG" != *"$EXPECTED_API_URL"* ]]; then
  echo "Runtime config endpoint did not expose the expected public URLs." >&2
  exit 1
fi

echo "Runtime config smoke test passed for $IMAGE"
