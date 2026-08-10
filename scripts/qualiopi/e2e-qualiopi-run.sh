#!/usr/bin/env bash
# Qualiopi — runner e2e SYSTÈME COMPLET (formations collectives), DB jetable pgvector.
#
# Provisionne une base Postgres+pgvector jetable, applique les migrations, lance
# la chaîne e2e formations collectives, puis détruit le conteneur (trap EXIT).
# Verdict unique « tout le système Qualiopi vert bout-en-bout ».
# (La chaîne 1-to-1 AFEST a été retirée le 2026-08-10 : le 1-to-1 est du
#  conseil, hors Qualiopi — décision 2026-07-17.)
#
# Usage :  pnpm e2e:qualiopi    (Docker requis ; sinon message clair + exit 2)
set -euo pipefail

CONTAINER="qualiopi-e2e-full-$$"
PORT="${E2E_PG_PORT:-55435}"
IMAGE="pgvector/pgvector:pg16"
DB_URL="postgresql://e2e:e2e@localhost:${PORT}/e2e?schema=public"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }

if ! docker info >/dev/null 2>&1; then
  echo "[e2e:qualiopi] ❌ Docker indisponible. Démarre Docker Desktop puis relance : pnpm e2e:qualiopi" >&2
  exit 2
fi
trap cleanup EXIT

echo "[e2e:qualiopi] 1/4 — base pgvector jetable ($CONTAINER, port $PORT)…"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=e2e -e POSTGRES_USER=e2e -e POSTGRES_DB=e2e -p "${PORT}:5432" "$IMAGE" >/dev/null

echo "[e2e:qualiopi] 2/4 — attente Postgres…"
for i in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U e2e -d e2e >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "${ready:-0}" = "1" ] || { echo "[e2e:qualiopi] ❌ Postgres timeout." >&2; exit 1; }

export DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" SKIP_ENV_VALIDATION=true BULLMQ_DISABLED=true

echo "[e2e:qualiopi] 3/4 — migrations…"
pnpm exec prisma migrate deploy

echo "[e2e:qualiopi] 4/4 — e2e FORMATIONS COLLECTIVES (14 docs + attestations + factures + conformité 22 + BPF)…"
pnpm exec tsx scripts/qualiopi/e2e-formations-verif.ts

echo "[e2e:qualiopi] ✅ Système complet vert. Résultats : _AUDIT/VERIF-QUALIOPI-1TO1-AFEST-2026-06-14/{e2e-formations-results.json,pdf/}"
