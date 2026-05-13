#!/bin/sh
# scripts/docker-entrypoint.sh
#
# Container startup script Axion-IA :
#   1. Applique les migrations Prisma en attente (`migrate deploy`).
#      → idempotent : si déjà à jour, no-op.
#      → en cas d'échec, log + abort (la prod ne doit PAS booter avec un
#        schéma désynchronisé du code).
#   2. Démarre Next.js standalone (`node server.js`).
#
# Variables d'env requises côté Coolify : DATABASE_URL, DIRECT_URL.
#
# Override sécurité : si SKIP_MIGRATE=1 → bypass la migration (utile pour
# rollback ou debug, mais à éviter en deploy normal).

set -e

echo "[entrypoint] Axion-IA container starting…"

if [ "${SKIP_MIGRATE:-0}" = "1" ]; then
  echo "[entrypoint] SKIP_MIGRATE=1 → skipping prisma migrate deploy"
else
  if [ -d "./prisma/migrations" ] && [ -n "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
    echo "[entrypoint] Running prisma migrate deploy…"
    node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma
    echo "[entrypoint] Migrations applied successfully."
  else
    echo "[entrypoint] WARNING: no prisma/migrations folder found in image — skipping migrate deploy."
    echo "[entrypoint] If V1 schema is expected, rebuild image with migrations included."
  fi
fi

echo "[entrypoint] Starting Next.js server on port ${PORT:-3000}…"
exec node server.js
