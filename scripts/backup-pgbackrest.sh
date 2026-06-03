#!/usr/bin/env bash
# Backup full/diff pgBackRest + check santé (ADR 0032 — PITR Postgres).
#
# Le WAL streaming continu (RPO < 1h) est assuré par `archive_command` côté
# Postgres (override Coolify), PAS par ce script. Ce script ne fait que :
#   - les backups full (hebdo) / diff (quotidien)
#   - `pgbackrest check` (détecte un WAL pile-up / repo cassé) → alerte
#
# S'exécute via `docker exec` dans le conteneur Postgres custom (pgbackrest inclus).
#
# Variables requises :
#   (les creds R2 + cipher sont déjà dans l'env du conteneur Postgres)
# Optionnel :
#   PG_CONTAINER (défaut axion-ia-postgres-prod), PGBACKREST_STANZA (défaut axionia)
#   TELEGRAM_*, HEALTHCHECK_URL_POSTGRES_PITR, BACKUP_REPORT_*
#
# Usage :
#   bash scripts/backup-pgbackrest.sh --type full     # hebdo
#   bash scripts/backup-pgbackrest.sh --type diff      # quotidien
#   bash scripts/backup-pgbackrest.sh --stanza-create  # init (une fois)

set -euo pipefail

COMPONENT="postgres_pitr"
COMPONENT_LABEL="PG-PITR"
PG_TYPE="diff"
STANZA_CREATE=""
for i in "$@"; do
  case "${i}" in
    full|diff|incr) PG_TYPE="${i}" ;;
    --stanza-create) STANZA_CREATE=1 ;;
  esac
done
[ "${1:-}" = "--type" ] && PG_TYPE="${2:-diff}"
BACKUP_TYPE="${PG_TYPE}"
source "$(dirname "$0")/backup-lib.sh"

PG_CONTAINER="${PG_CONTAINER:-axion-ia-postgres-prod}"
PGBACKREST_STANZA="${PGBACKREST_STANZA:-axionia}"

pgbr() { docker exec -u postgres "${PG_CONTAINER}" pgbackrest --stanza="${PGBACKREST_STANZA}" "$@"; }

healthcheck_ping "/start"

if [ -n "${STANZA_CREATE}" ]; then
  echo "→ pgbackrest stanza-create"
  pgbr stanza-create || { record_fail "stanza_create_failed"; exit 1; }
  echo "✅ Stanza ${PGBACKREST_STANZA} créée."
  exit 0
fi

START_TS=$(date +%s)

echo "→ pgbackrest check (intégrité repo + archivage WAL)"
if ! pgbr check; then
  record_fail "pgbackrest_check_failed"   # WAL pile-up possible → P0
  exit 1
fi

echo "→ pgbackrest backup --type=${PG_TYPE}"
if ! pgbr backup "--type=${PG_TYPE}"; then
  record_fail "pgbackrest_backup_${PG_TYPE}_failed"
  exit 1
fi

# Taille du dernier backup depuis `info --output=json` (best-effort).
SIZE_BYTES=$(pgbr info --output=json 2>/dev/null \
  | grep -o '"size":[0-9]*' | tail -1 | grep -o '[0-9]*' || echo null)
DURATION=$(( $(date +%s) - START_TS ))
record_success
report_backup_run "success" "${SIZE_BYTES:-null}" "${DURATION}" "r2-pgbackrest" "stanza:${PGBACKREST_STANZA}/${PG_TYPE}"
healthcheck_ping
notify_telegram "OK ${PG_TYPE} · ${DURATION}s (repo R2)" "🟢"
echo "✅ pgBackRest ${PG_TYPE} OK."
