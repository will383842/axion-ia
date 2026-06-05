#!/bin/sh
# scripts/docker-entrypoint.sh
#
# Container startup script Axion-IA :
#   1. Tente d'appliquer les migrations Prisma au boot.
#      → idempotent : si déjà à jour, no-op.
#      → Priorise /app/prisma-cli/node_modules/.bin/prisma (fresh install via
#        npm au builder stage, cf. Dockerfile audit deploy-unstuck 2026-05-18)
#        car node_modules/.bin/prisma local a des symlinks pnpm brisés
#        (@prisma/engines introuvable dans le standalone slim runtime).
#      → Fallback npx puis ./node_modules/.bin/prisma si /app/prisma-cli absent.
#      → SI tout fail : log warning + continue (best-effort), boot Next.js.
#   2. Démarre Next.js standalone (`node server.js`).
#
# Variables d'env requises côté Coolify : DATABASE_URL, DIRECT_URL.
#
# Override sécurité : si SKIP_MIGRATE=1 → bypass la migration (utile pour
# rollback ou debug, mais à éviter en deploy normal).
#
# Sprint Prisma path fix 2026-05-17 — retiré `set -e` global pour éviter que
# une erreur dans les blocs subshell ne propage exit code à Coolify
# (qui marque alors deploy "failed" alors que le container démarre OK).
# Le `exec node server.js` à la fin = success implicite si serveur démarre.

echo "[entrypoint] Axion-IA container starting…"

# Audit deploy-unstuck 2026-05-18 — sélection binaire prisma fonctionnel.
# Préférence : fresh CLI installé via npm au builder stage > local pnpm
# (symlinks brisés) > npx en dernier recours.
if [ -x "/app/prisma-cli/node_modules/.bin/prisma" ]; then
  PRISMA_BIN="/app/prisma-cli/node_modules/.bin/prisma"
  PRISMA_BIN_KIND="fresh-npm /app/prisma-cli"
elif [ -x "./node_modules/.bin/prisma" ]; then
  PRISMA_BIN="./node_modules/.bin/prisma"
  PRISMA_BIN_KIND="pnpm local (may fail due to broken symlinks)"
else
  PRISMA_BIN=""
  PRISMA_BIN_KIND="(none)"
fi
echo "[entrypoint] Prisma binary selection: $PRISMA_BIN_KIND"

if [ "${SKIP_MIGRATE:-0}" = "1" ]; then
  echo "[entrypoint] SKIP_MIGRATE=1 → skipping prisma migrate deploy"
elif [ ! -d "./prisma/migrations" ] || [ -z "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
  echo "[entrypoint] WARNING: no prisma/migrations folder found in image — skipping migrate deploy."
elif [ -z "$PRISMA_BIN" ]; then
  echo "[entrypoint] WARNING: no prisma CLI available. Skipping auto-migrate."
  echo "[entrypoint] Trigger manually: gh workflow run admin-emergency-migrate.yml -f action=migrate"
else
  echo "[entrypoint] Running prisma migrate deploy via $PRISMA_BIN…"
  # Run in subshell with 'set +e' so prisma failure doesn't abort container.
  MIGRATE_OK=0
  if ( set +e; "$PRISMA_BIN" migrate deploy --schema=./prisma/schema.prisma ); then
    echo "[entrypoint] Migrations applied successfully ($PRISMA_BIN_KIND)."
    MIGRATE_OK=1
  else
    # Fallback npx — télécharge prisma + engines à la volée (~30s cold-start).
    echo "[entrypoint] Primary prisma failed. Retrying via npx --yes prisma@5.22.0…"
    if ( set +e; npx --yes prisma@5.22.0 migrate deploy --schema=./prisma/schema.prisma ); then
      echo "[entrypoint] Migrations applied successfully (npx fallback)."
      MIGRATE_OK=1
    else
      echo "[entrypoint] WARNING: prisma migrate deploy failed via $PRISMA_BIN_KIND AND npx."
      echo "[entrypoint] Container will boot anyway. Apply migrations manually:"
      echo "[entrypoint]   gh workflow run admin-emergency-migrate.yml -f action=migrate"
    fi
  fi
  unset MIGRATE_OK
fi

# H1 / VIS (audit visibilité 2026-06-05) — applique les setups FTS raw SQL
# (colonnes tsvector GENERATED + index GIN/trgm) que `prisma migrate deploy` ne
# gère PAS. Sans `knowledge_translations.search_vector`, `searchKnowledge` throw
# → toute la génération content-gen (RAG/KB) casse sur une DB reconstruite.
# Tous les fichiers sont idempotents (ADD COLUMN / CREATE INDEX IF NOT EXISTS) :
# le 1er boot crée, les suivants sont des no-op rapides. NON-fatal (ne bloque
# jamais le boot). Utilise `prisma db execute` (binaire déjà présent, pas besoin
# de psql). DATABASE_URL = vraie DB prod au runtime (jamais stub.invalid).
if [ -n "$PRISMA_BIN" ] && [ -d "./prisma/migrations_fts" ]; then
  for sql in ./prisma/migrations_fts/*.sql; do
    [ -f "$sql" ] || continue
    echo "[entrypoint] Applying FTS setup: $sql"
    if ( set +e; "$PRISMA_BIN" db execute --file "$sql" --schema=./prisma/schema.prisma ); then
      echo "[entrypoint] FTS setup applied: $sql"
    else
      echo "[entrypoint] WARNING: FTS setup $sql failed (non-fatal, idempotent retry next boot)."
    fi
  done
fi

echo "[entrypoint] Starting Next.js server on port ${PORT:-3000}…"
exec node server.js
