#!/usr/bin/env bash
# Backup Plausible (Postgres config + ClickHouse events) chiffré → R2 (ADR 0032).
#
# Analytics : perte tolérable → rétention courte. ClickHouse peut être volumineux.
# ⚠️ Deux définitions compose coexistent (infra/plausible/ vs docker/monitoring/) :
# cibler la stack RÉELLEMENT déployée via les env *_CONTAINER (cf. CRON-VPS-INVENTORY).
#
# Variables requises : BACKUP_ENCRYPTION_PASSPHRASE, R2_* (BUCKET_NAME/ENDPOINT/keys)
# Optionnel :
#   PLAUSIBLE_PG_CONTAINER (défaut axion-ia-plausible-pg), PLAUSIBLE_PG_USER (défaut postgres),
#   PLAUSIBLE_PG_DB (défaut plausible_db)
#   PLAUSIBLE_CH_CONTAINER (défaut axion-ia-plausible-ch), PLAUSIBLE_CH_DB (défaut plausible_events_db)
#   PLAUSIBLE_CH_USER / PLAUSIBLE_CH_PASSWORD
#   TELEGRAM_*, HEALTHCHECK_URL_PLAUSIBLE_PG / _PLAUSIBLE_CLICKHOUSE, BACKUP_REPORT_*
#
# Usage : bash scripts/backup-plausible.sh [--type daily|weekly|monthly]

set -euo pipefail

case "${1:-}" in --type) BACKUP_TYPE="${2:-daily}" ;; daily|weekly|monthly) BACKUP_TYPE="$1" ;; esac
BACKUP_TYPE="${BACKUP_TYPE:-daily}"

PLAUSIBLE_PG_CONTAINER="${PLAUSIBLE_PG_CONTAINER:-axion-ia-plausible-pg}"
PLAUSIBLE_PG_USER="${PLAUSIBLE_PG_USER:-postgres}"
PLAUSIBLE_PG_DB="${PLAUSIBLE_PG_DB:-plausible_db}"
PLAUSIBLE_CH_CONTAINER="${PLAUSIBLE_CH_CONTAINER:-axion-ia-plausible-ch}"
PLAUSIBLE_CH_DB="${PLAUSIBLE_CH_DB:-plausible_events_db}"

# Source la lib avec un composant générique ; on POST deux runs distincts.
COMPONENT="plausible_pg"
COMPONENT_LABEL="PLAUSIBLE"
source "$(dirname "$0")/backup-lib.sh"

WORK_DIR="$(mktemp -d -t axion-ia-plausible-XXXXXX)"
trap 'rm -rf "${WORK_DIR}"' EXIT
RETENTION_COUNT="${PLAUSIBLE_RETENTION:-7}"

healthcheck_ping "/start"
require_var BACKUP_ENCRYPTION_PASSPHRASE
require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY
require_var R2_BUCKET_NAME
require_var R2_ENDPOINT

# ─── 1. Postgres Plausible ───────────────────────────────────────────────────
START_TS=$(date +%s)
PG_NAME="axion-ia-plausible-pg-${BACKUP_TYPE}-${DATE_TAG}-${HOSTNAME_TAG}.dump.gz.enc"
echo "→ pg_dump Plausible (${PLAUSIBLE_PG_CONTAINER}/${PLAUSIBLE_PG_DB})"
if docker exec "${PLAUSIBLE_PG_CONTAINER}" sh -c \
     "pg_dump --format=custom --no-owner --no-acl -U '${PLAUSIBLE_PG_USER}' '${PLAUSIBLE_PG_DB}'" 2>/dev/null \
     | gzip -9 | encrypt_aes > "${WORK_DIR}/${PG_NAME}"; then
  PG_BYTES=$(stat -c%s "${WORK_DIR}/${PG_NAME}")
  PG_KEY="plausible/pg/${BACKUP_TYPE}/${PG_NAME}"
  upload_r2 "${WORK_DIR}/${PG_NAME}" "${R2_BUCKET_NAME}" "${PG_KEY}" || { record_fail "pg_r2_upload"; exit 1; }
  prune_r2 "${R2_BUCKET_NAME}" "plausible/pg/${BACKUP_TYPE}/" "${RETENTION_COUNT}"
  report_backup_run "success" "${PG_BYTES}" "$(( $(date +%s) - START_TS ))" "r2" "${PG_KEY}"
  echo "  ✅ PG OK ($(du -h "${WORK_DIR}/${PG_NAME}" | cut -f1))"
else
  record_fail "plausible_pg_dump_failed"
fi

# ─── 2. ClickHouse events ────────────────────────────────────────────────────
COMPONENT="plausible_clickhouse"
START_TS=$(date +%s)
CH_NAME="axion-ia-plausible-ch-${BACKUP_TYPE}-${DATE_TAG}-${HOSTNAME_TAG}.sql.gz.enc"
echo "→ Export ClickHouse (${PLAUSIBLE_CH_CONTAINER}/${PLAUSIBLE_CH_DB})"
CH_AUTH=""
[ -n "${PLAUSIBLE_CH_USER:-}" ] && CH_AUTH="--user ${PLAUSIBLE_CH_USER}"
[ -n "${PLAUSIBLE_CH_PASSWORD:-}" ] && CH_AUTH="${CH_AUTH} --password ${PLAUSIBLE_CH_PASSWORD}"
# Dump logique de toutes les tables du schéma events (TabSeparated + CREATE).
if docker exec "${PLAUSIBLE_CH_CONTAINER}" sh -c \
     "clickhouse-client ${CH_AUTH} --query \"SHOW TABLES FROM ${PLAUSIBLE_CH_DB}\"" 2>/dev/null > "${WORK_DIR}/ch_tables.txt"; then
  {
    while IFS= read -r tbl; do
      [ -z "${tbl}" ] && continue
      docker exec "${PLAUSIBLE_CH_CONTAINER}" sh -c \
        "clickhouse-client ${CH_AUTH} --query \"SHOW CREATE TABLE ${PLAUSIBLE_CH_DB}.${tbl}\" --format TSVRaw" 2>/dev/null
      echo ";"
      docker exec "${PLAUSIBLE_CH_CONTAINER}" sh -c \
        "clickhouse-client ${CH_AUTH} --query \"SELECT * FROM ${PLAUSIBLE_CH_DB}.${tbl} FORMAT Native\"" 2>/dev/null \
        | base64 > "${WORK_DIR}/ch_${tbl}.native.b64" || true
    done < "${WORK_DIR}/ch_tables.txt"
  } > "${WORK_DIR}/ch_schema.sql"
  tar -C "${WORK_DIR}" -cf - ch_schema.sql ch_tables.txt $(cd "${WORK_DIR}" && ls ch_*.native.b64 2>/dev/null) \
    | gzip -9 | encrypt_aes > "${WORK_DIR}/${CH_NAME}"
  CH_BYTES=$(stat -c%s "${WORK_DIR}/${CH_NAME}")
  CH_KEY="plausible/ch/${BACKUP_TYPE}/${CH_NAME}"
  upload_r2 "${WORK_DIR}/${CH_NAME}" "${R2_BUCKET_NAME}" "${CH_KEY}" \
    && prune_r2 "${R2_BUCKET_NAME}" "plausible/ch/${BACKUP_TYPE}/" "${RETENTION_COUNT}" \
    && report_backup_run "success" "${CH_BYTES}" "$(( $(date +%s) - START_TS ))" "r2" "${CH_KEY}" \
    && echo "  ✅ ClickHouse OK ($(du -h "${WORK_DIR}/${CH_NAME}" | cut -f1))" \
    || record_fail "ch_r2_upload"
else
  record_fail "plausible_ch_export_failed"
fi

record_success
healthcheck_ping
notify_telegram "Plausible OK ${BACKUP_TYPE}" "🟢"
echo "✅ Backup Plausible terminé."
