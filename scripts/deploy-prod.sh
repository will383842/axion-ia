#!/usr/bin/env bash
# Script deploiement production Axion-IA — Sprint 22 (M11).
#
# Pre-requis :
#   - SSH access Hetzner CPX32 (ou Coolify CLI)
#   - .env.production deploye via Coolify env vars
#   - DNS axion-ia.com → Cloudflare proxied → Hetzner IP
#
# Workflow :
#   1. Pull latest main (CI a deja merge)
#   2. Build images Docker (app + worker)
#   3. Apply Prisma migrations (zero-downtime via prisma migrate deploy)
#   4. Run FTS post-migration (idempotent)
#   5. Restart services via docker compose
#   6. Smoke test healthz
#   7. Notify Telegram (Sprint 23 alerts)
#
# Usage :
#   bash scripts/deploy-prod.sh                  # deploy normal
#   bash scripts/deploy-prod.sh --skip-migrate   # skip migrations (rollback safe)
#   bash scripts/deploy-prod.sh --dry-run        # preview, no exec
set -euo pipefail

# ============================================================
# Config
# ============================================================
DOCKER_COMPOSE="docker compose -f docker/docker-compose.production.yml"
PROD_ENV_FILE=".env.production"
HEALTHZ_URL="${HEALTHZ_URL:-http://localhost:3000/api/healthz}"
SKIP_MIGRATE=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --skip-migrate) SKIP_MIGRATE=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

run() {
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] $*"
  else
    eval "$@"
  fi
}

log() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"; }

# ============================================================
# 1. Pre-check env
# ============================================================
log "→ Pre-check environnement"
[ -f "$PROD_ENV_FILE" ] || { echo "Missing $PROD_ENV_FILE"; exit 1; }

# Verify required env vars present
required_vars=(POSTGRES_PASSWORD REDIS_PASSWORD AUTH_SECRET ADMIN_URL_PREFIX TURNSTILE_SECRET_KEY INDEXNOW_KEY)
for var in "${required_vars[@]}"; do
  grep -q "^${var}=" "$PROD_ENV_FILE" || { echo "Missing required env var: $var"; exit 1; }
done
log "  ✓ env file OK"

# ============================================================
# 2. Pull main + build
# ============================================================
log "→ Pull origin/main"
run "git fetch origin main && git checkout main && git pull"

log "→ Build images Docker"
run "$DOCKER_COMPOSE --env-file $PROD_ENV_FILE build app worker"

# ============================================================
# 3. Migrations Prisma (zero-downtime)
# ============================================================
if [ "$SKIP_MIGRATE" = false ]; then
  log "→ Apply Prisma migrations"
  run "$DOCKER_COMPOSE --env-file $PROD_ENV_FILE run --rm app pnpm prisma migrate deploy"

  log "→ Run FTS post-migration (idempotent)"
  run "$DOCKER_COMPOSE --env-file $PROD_ENV_FILE exec -T postgres psql -U axion_ia -d axion_ia_prod < prisma/migrations_fts/0002_fts_setup.sql || true"
else
  log "→ SKIP migrations (--skip-migrate flag)"
fi

# ============================================================
# 4. Restart services (rolling)
# ============================================================
log "→ Up services"
run "$DOCKER_COMPOSE --env-file $PROD_ENV_FILE up -d --force-recreate app worker"

# ============================================================
# 5. Wait healthz
# ============================================================
log "→ Wait healthz (max 60s)"
if [ "$DRY_RUN" = false ]; then
  for i in $(seq 1 30); do
    if curl -fsS "$HEALTHZ_URL" >/dev/null 2>&1; then
      log "  ✓ healthz OK ($i tries)"
      break
    fi
    [ "$i" -eq 30 ] && { echo "✗ healthz timeout"; exit 2; }
    sleep 2
  done
fi

# ============================================================
# 6. Smoke test critical endpoints
# ============================================================
log "→ Smoke test endpoints"
if [ "$DRY_RUN" = false ]; then
  curl -fsS -o /dev/null "$HEALTHZ_URL"
  curl -fsS -o /dev/null "${HEALTHZ_URL/healthz/og?title=test}" || log "  WARN OG endpoint failed (non-bloquant)"
fi

# ============================================================
# 7. Notify Telegram (Sprint 23 alert)
# ============================================================
if [ "$DRY_RUN" = false ] && [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  COMMIT_SHA=$(git rev-parse --short HEAD)
  COMMIT_MSG=$(git log -1 --pretty=%B | head -1)
  curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "content-type: application/json" \
    -d "{\"chat_id\":\"${TELEGRAM_CHAT_ID}\",\"text\":\"*[DEPLOY]* axion-ia.com OK\\n• Commit: \\\`${COMMIT_SHA}\\\`\\n• Msg: ${COMMIT_MSG}\\n• Healthz: ✓\",\"parse_mode\":\"Markdown\"}" >/dev/null
fi

log "✓ Deploy complete"
