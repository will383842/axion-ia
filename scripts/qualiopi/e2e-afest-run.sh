#!/usr/bin/env bash
# Qualiopi 1-to-1 / AFEST — runner e2e « tout-en-un » (DB jetable pgvector).
#
# Provisionne une base Postgres+pgvector jetable (Docker), applique les
# migrations, lance la chaîne e2e (protocole → attestation → kits OPCO/CPF/FT →
# convention → certificat → facture ventilation → BPF + PDF réels), puis
# détruit le conteneur — quoi qu'il arrive (trap EXIT).
#
# Usage :  bash scripts/qualiopi/e2e-afest-run.sh   (ou : pnpm e2e:afest)
# Pré-requis : Docker en marche. Si Docker est indisponible, message clair + exit 2.
set -euo pipefail

CONTAINER="qualiopi-e2e-$$"
PORT="${E2E_PG_PORT:-55434}"
IMAGE="pgvector/pgvector:pg16"
DB_URL="postgresql://e2e:e2e@localhost:${PORT}/e2e?schema=public"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}

if ! docker info >/dev/null 2>&1; then
  cat >&2 <<'MSG'
[e2e:afest] ❌ Docker n'est pas disponible.
  Démarre Docker Desktop (interactif), attends que la baleine soit verte, puis relance :
      pnpm e2e:afest
  (Le moteur Linux de Docker Desktop ne peut pas démarrer depuis une session headless.)
MSG
  exit 2
fi

trap cleanup EXIT

echo "[e2e:afest] 1/4 — démarrage de la base pgvector jetable ($CONTAINER, port $PORT)…"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=e2e -e POSTGRES_USER=e2e -e POSTGRES_DB=e2e \
  -p "${PORT}:5432" "$IMAGE" >/dev/null

echo "[e2e:afest] 2/4 — attente de la disponibilité de Postgres…"
for i in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U e2e -d e2e >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 1
done
if [ "${ready:-0}" != "1" ]; then
  echo "[e2e:afest] ❌ Postgres n'a pas démarré dans le délai imparti." >&2
  exit 1
fi

export DATABASE_URL="$DB_URL"
export DIRECT_URL="$DB_URL"
export SKIP_ENV_VALIDATION=true
export BULLMQ_DISABLED=true

echo "[e2e:afest] 3/4 — application des migrations (prisma migrate deploy)…"
pnpm exec prisma migrate deploy

echo "[e2e:afest] 4/4 — exécution de la chaîne e2e (services réels + PDF)…"
pnpm exec tsx scripts/qualiopi/e2e-afest-verif.ts

echo "[e2e:afest] ✅ Terminé. Résultats : _AUDIT/VERIF-QUALIOPI-1TO1-AFEST-2026-06-14/{e2e-results.json,pdf/}"
