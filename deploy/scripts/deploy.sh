#!/bin/bash
# Deploy script — runs on the VPS after GitHub Actions builds the image
# Usage: ./deploy.sh [v1.2.0]  (default: reads IMAGE_TAG from .env.deploy)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load VPS config
if [[ -f "${SCRIPT_DIR}/../../.env.deploy" ]]; then
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/../../.env.deploy"
fi

# Config with defaults
APP_NAME="${APP_NAME:-__APP_NAME__}"
DOMAIN="${DOMAIN:-localhost}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-app}"
DEPLOY_PATH="${DEPLOY_PATH:-/data/${APP_NAME}}"
MAINTENANCE_FLAG="${MAINTENANCE_FLAG:-/data/swag/nginx/${APP_NAME}.maintenance.flag}"
IMAGE="ghcr.io/__GITHUB_USER__/${APP_NAME}"
HEALTH_TIMEOUT=90

TAG="${1:-${IMAGE_TAG:-latest}}"
COMPOSE_FILE="${DEPLOY_PATH}/docker-compose.yml"

echo "==> Deploying ${APP_NAME}:${TAG} to ${DOMAIN}"

# 1. Enable maintenance mode
echo "==> Maintenance mode ON"
touch "${MAINTENANCE_FLAG}" 2>/dev/null || true

# 2. Pull new image
echo "==> Pulling ${IMAGE}:${TAG}"
docker pull "${IMAGE}:${TAG}"

# 3. Re-tag as local reference
docker tag "${IMAGE}:${TAG}" "${APP_NAME}:latest"

# 4. Restart the service
echo "==> Restarting ${COMPOSE_SERVICE}"
docker compose -f "${COMPOSE_FILE}" up -d --no-deps "${COMPOSE_SERVICE}"

# 5. Poll healthcheck
echo "==> Waiting for healthcheck..."
elapsed=0
until [[ "$(docker inspect --format='{{.State.Health.Status}}' "${APP_NAME}" 2>/dev/null)" == "healthy" ]]; do
  if (( elapsed >= HEALTH_TIMEOUT )); then
    echo "✗ Healthcheck timed out — maintenance mode left ON for safety"
    echo "  Check: docker logs ${APP_NAME} --tail 50"
    exit 1
  fi
  sleep 3
  (( elapsed += 3 ))
done

# 6. Disable maintenance mode
echo "==> Maintenance mode OFF"
rm -f "${MAINTENANCE_FLAG}"

# 7. Prune old images (keep current + 1 for rollback)
echo "==> Pruning old images"
docker images "${IMAGE}" --format "{{.Tag}}" \
  | grep -v "^${TAG}$" \
  | tail -n +2 \
  | xargs -I{} docker rmi "${IMAGE}:{}" 2>/dev/null || true

echo "✓ ${APP_NAME} ${TAG} deployed successfully — https://${DOMAIN}"
