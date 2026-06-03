#!/usr/bin/env bash
# Backup Docuseal (DB + PDF signés) chiffré → R2 + Hetzner Storage Box (ADR 0032).
#
# 🔴 P0 : les PDF signés = valeur légale, irremplaçables. Rétention longue.
# V1 Docuseal = SQLite embarqué dans le volume docuseal-data:/data.
# Dump cohérent via `VACUUM INTO` (jamais un cp à chaud du fichier ouvert).
# Mode --pg réservé pour la future migration Postgres.
#
# Variables requises :
#   BACKUP_ENCRYPTION_PASSPHRASE, R2_* (BUCKET_NAME/ENDPOINT/keys)
# Optionnel :
#   DOCUSEAL_CONTAINER (défaut axion-ia-docuseal), DOCUSEAL_DATA_PATH (défaut /data)
#   DOCUSEAL_SQLITE (défaut /data/docuseal.sqlite3)
#   HETZNER_STORAGE_USER/HOST, TELEGRAM_*, HEALTHCHECK_URL_DOCUSEAL, BACKUP_REPORT_*
#
# Usage : bash scripts/backup-docuseal.sh [--type daily|weekly|monthly] [--pg]

set -euo pipefail

COMPONENT="docuseal"
COMPONENT_LABEL="DOCUSEAL"
MODE_PG=""
for arg in "$@"; do case "${arg}" in --pg) MODE_PG=1 ;; daily|weekly|monthly) BACKUP_TYPE="${arg}" ;; esac; done
[ "${1:-}" = "--type" ] && BACKUP_TYPE="${2:-monthly}"
BACKUP_TYPE="${BACKUP_TYPE:-monthly}"   # docs légaux → défaut monthly
source "$(dirname "$0")/backup-lib.sh"

DOCUSEAL_CONTAINER="${DOCUSEAL_CONTAINER:-axion-ia-docuseal}"
DOCUSEAL_DATA_PATH="${DOCUSEAL_DATA_PATH:-/data}"
DOCUSEAL_SQLITE="${DOCUSEAL_SQLITE:-/data/docuseal.sqlite3}"
# Rétention longue pour les contrats signés (override possible via env).
case "${BACKUP_TYPE}" in
  monthly) RETENTION_COUNT="${DOCUSEAL_MONTHLY_RETENTION:-24}" ;;
  *)       RETENTION_COUNT="$(retention_for_type "${BACKUP_TYPE}")" ;;
esac
BACKUP_NAME="axion-ia-docuseal-${BACKUP_TYPE}-${DATE_TAG}-${HOSTNAME_TAG}.tar.gz.enc"
WORK_DIR="$(mktemp -d -t axion-ia-docuseal-XXXXXX)"
trap 'rm -rf "${WORK_DIR}"' EXIT

healthcheck_ping "/start"
require_var BACKUP_ENCRYPTION_PASSPHRASE
require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY
require_var R2_BUCKET_NAME
require_var R2_ENDPOINT

START_TS=$(date +%s)
mkdir -p "${WORK_DIR}/payload"

if [ -n "${MODE_PG}" ]; then
  echo "→ Dump Postgres Docuseal (mode --pg)"
  require_var DOCUSEAL_DATABASE_URL
  PG_URL="${DOCUSEAL_DATABASE_URL%%\?*}"
  docker exec "${DOCUSEAL_CONTAINER}" sh -c "pg_dump --format=custom --no-owner --no-acl '${PG_URL}'" \
    > "${WORK_DIR}/payload/docuseal.dump" || { record_fail "pg_dump_failed"; exit 1; }
else
  echo "→ Dump SQLite cohérent (VACUUM INTO)"
  docker exec "${DOCUSEAL_CONTAINER}" sh -c \
    "sqlite3 '${DOCUSEAL_SQLITE}' \"VACUUM INTO '${DOCUSEAL_DATA_PATH}/_backup.sqlite3'\"" \
    || { record_fail "sqlite_vacuum_failed"; exit 1; }
  docker cp "${DOCUSEAL_CONTAINER}:${DOCUSEAL_DATA_PATH}/_backup.sqlite3" "${WORK_DIR}/payload/docuseal.sqlite3"
  docker exec "${DOCUSEAL_CONTAINER}" rm -f "${DOCUSEAL_DATA_PATH}/_backup.sqlite3" || true
fi

echo "→ Archive des PDF signés"
# Tar du volume /data côté conteneur, en excluant les bases déjà dumpées.
docker exec "${DOCUSEAL_CONTAINER}" tar -C "${DOCUSEAL_DATA_PATH}" \
  --exclude='*.sqlite3' --exclude='_backup.sqlite3' -cf - . 2>/dev/null \
  > "${WORK_DIR}/payload/files.tar" || { record_fail "pdf_tar_failed"; exit 1; }

echo "→ gzip + encrypt"
tar -C "${WORK_DIR}/payload" -cf - . | gzip -9 | encrypt_aes > "${WORK_DIR}/${BACKUP_NAME}"
SIZE_BYTES=$(stat -c%s "${WORK_DIR}/${BACKUP_NAME}")
SIZE_HUMAN=$(du -h "${WORK_DIR}/${BACKUP_NAME}" | cut -f1)

echo "→ Upload R2"
REMOTE_KEY="docuseal/${BACKUP_TYPE}/${BACKUP_NAME}"
# monthly = destination immuable (valeur légale) si bucket immuable configuré.
if [ "${BACKUP_TYPE}" = "monthly" ] && [ -n "${R2_BUCKET_IMMUTABLE:-}" ]; then
  upload_r2 "${WORK_DIR}/${BACKUP_NAME}" "${R2_BUCKET_IMMUTABLE}" "${REMOTE_KEY}" immutable 730 \
    || { record_fail "r2_immutable_upload"; exit 1; }
else
  upload_r2 "${WORK_DIR}/${BACKUP_NAME}" "${R2_BUCKET_NAME}" "${REMOTE_KEY}" || { record_fail "r2_upload"; exit 1; }
  prune_r2 "${R2_BUCKET_NAME}" "docuseal/${BACKUP_TYPE}/" "${RETENTION_COUNT}"
fi

if [ -n "${HETZNER_STORAGE_USER:-}" ] && [ -n "${HETZNER_STORAGE_HOST:-}" ]; then
  rsync -avz --partial-dir=.partial "${WORK_DIR}/${BACKUP_NAME}" \
    "${HETZNER_STORAGE_USER}@${HETZNER_STORAGE_HOST}:/backups/docuseal/${BACKUP_TYPE}/${BACKUP_NAME}" \
    >/dev/null 2>&1 || notify_telegram "Storage Box upload KO (R2 OK)" "🟠"
  DEST="r2+storagebox"
else
  DEST="r2"
fi

DURATION=$(( $(date +%s) - START_TS ))
record_success
report_backup_run "success" "${SIZE_BYTES}" "${DURATION}" "${DEST}" "${REMOTE_KEY}"
healthcheck_ping
notify_telegram "OK ${BACKUP_TYPE} · ${SIZE_HUMAN} · ${DURATION}s" "🟢"
echo "✅ Backup Docuseal OK : ${REMOTE_KEY} (${SIZE_HUMAN})"
