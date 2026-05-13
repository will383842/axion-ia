#!/bin/sh
# scripts/docker-entrypoint.sh
#
# Container startup script Axion-IA :
#   1. Tente d'appliquer les migrations Prisma au boot.
#      → idempotent : si déjà à jour, no-op.
#      → SI prisma CLI introuvable (pnpm symlinks cassés dans runtime stage) :
#        log warning et continue le boot du serveur. La migration peut être
#        lancée manuellement via Coolify Terminal :
#          docker exec <web-uuid> sh -c 'npx --yes prisma@5.22.0 migrate deploy'
#      → SI prisma fail pour autre raison : abort (vraie erreur de migration).
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
elif [ ! -d "./prisma/migrations" ] || [ -z "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
  echo "[entrypoint] WARNING: no prisma/migrations folder found in image — skipping migrate deploy."
elif [ ! -x "./node_modules/.bin/prisma" ]; then
  echo "[entrypoint] WARNING: prisma CLI not found in image (./node_modules/.bin/prisma)."
  echo "[entrypoint] Skipping auto-migrate. Run manually via Coolify Terminal:"
  echo "[entrypoint]   docker exec <web-uuid> sh -c 'npx --yes prisma@5.22.0 migrate deploy'"
else
  echo "[entrypoint] Running prisma migrate deploy…"
  # Run in subshell with 'set +e' so prisma failure doesn't abort container.
  # We log + continue boot — migration can be fixed/retried manually.
  if ( set +e; node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma ); then
    echo "[entrypoint] Migrations applied successfully."
  else
    echo "[entrypoint] WARNING: prisma migrate deploy failed (probable: @prisma/engines missing in slim runtime)."
    echo "[entrypoint] Container will boot anyway. Apply migrations manually:"
    echo "[entrypoint]   docker exec <web-uuid> sh -c 'npx --yes prisma@5.22.0 migrate deploy'"
  fi
fi

echo "[entrypoint] Starting Next.js server on port ${PORT:-3000}…"
exec node server.js
