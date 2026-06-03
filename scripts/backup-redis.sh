#!/usr/bin/env bash
# Backup Redis (BullMQ) chiffré → Cloudflare R2 + Hetzner Storage Box (ADR 0032).
#
# Redis n'héberge que des queues BullMQ + cache (reconstructibles) → RPO lâche,
# backup "confort". On snapshot le RDB via BGSAVE (cohérent) plutôt qu'un cp AOF.
#
# Variables requises :
#   REDIS_PASSWORD                Auth Redis
#   BACKUP_ENCRYPTION_PASSPHRASE  AES-256
#   R2_* (ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET_NAME, ENDPOINT)
#   HETZNER_STORAGE_USER / HETZNER_STORAGE_HOST  (optionnel, 2e destination)
# Optionnel :
#   REDIS_CONTAINER (défaut axion-ia-redis-prod), REDIS_DATA_PATH (défaut /data)
#   TELEGRAM_*, HEALTHCHECK_URL_REDIS, BACKUP_REPORT_URL, BACKUP_INGEST_SECRET
#
# Usage : bash scripts/backup-redis.sh [--type daily|weekly|monthly]

set -euo pipefail

COMPONENT="redis"
COMPONENT_LABEL="REDIS"
case "${1:-}" in --type) BACKUP_TYPE="${2:-daily}" ;; daily|weekly|monthly) BACKUP_TYPE="$1" ;; esac
BACKUP_TYPE="${BACKUP_TYPE:-daily}"
source "$(dirname "$0")/backup-lib.sh"

REDIS_CONTAINER="${REDIS_CONTAINER:-axion-ia-redis-prod}"
REDIS_DATA_PATH="${REDIS_DATA_PATH:-/data}"
RETENTION_COUNT="$(retention_for_type "${BACKUP_TYPE}")"
BACKUP_NAME="axion-ia-redis-${BACKUP_TYPE}-${DATE_TAG}-${HOSTNAME_TAG}.rdb.gz.enc"
WORK_DIR="$(mktemp -d -t axion-ia-redis-XXXXXX)"
trap 'rm -rf "${WORK_DIR}"' EXIT

healthcheck_ping "/start"
require_var REDIS_PASSWORD
require_var BACKUP_ENCRYPTION_PASSPHRASE
require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY
require_var R2_BUCKET_NAME
require_var R2_ENDPOINT

START_TS=$(date +%s)

echo "→ BGSAVE Redis (${REDIS_CONTAINER})"
LAST_SAVE_BEFORE=$(docker exec "${REDIS_CONTAINER}" redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning LASTSAVE 2>/dev/null | tr -dc '0-9' || echo 0)
docker exec "${REDIS_CONTAINER}" redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning BGSAVE >/dev/null 2>&1 || {
  record_fail "bgsave_failed"; exit 1; }
# Attendre la fin du BGSAVE (LASTSAVE incrémenté), max 120s.
for _ in $(seq 1 60); do
  NOW=$(docker exec "${REDIS_CONTAINER}" redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning LASTSAVE 2>/dev/null | tr -dc '0-9' || echo 0)
  [ "${NOW}" != "${LAST_SAVE_BEFORE}" ] && break
  sleep 2
done

echo "→ Copie dump.rdb → gzip → encrypt"
docker cp "${REDIS_CONTAINER}:${REDIS_DATA_PATH}/dump.rdb" "${WORK_DIR}/dump.rdb" || {
  record_fail "dump_copy_failed"; exit 1; }
gzip -9 < "${WORK_DIR}/dump.rdb" | encrypt_aes > "${WORK_DIR}/${BACKUP_NAME}"

SIZE_BYTES=$(stat -c%s "${WORK_DIR}/${BACKUP_NAME}")
SIZE_HUMAN=$(du -h "${WORK_DIR}/${BACKUP_NAME}" | cut -f1)

echo "→ Upload R2"
REMOTE_KEY="redis/${BACKUP_TYPE}/${BACKUP_NAME}"
upload_r2 "${WORK_DIR}/${BACKUP_NAME}" "${R2_BUCKET_NAME}" "${REMOTE_KEY}" || { record_fail "r2_upload"; exit 1; }
prune_r2 "${R2_BUCKET_NAME}" "redis/${BACKUP_TYPE}/" "${RETENTION_COUNT}"

# 2e destination Storage Box (optionnelle)
if [ -n "${HETZNER_STORAGE_USER:-}" ] && [ -n "${HETZNER_STORAGE_HOST:-}" ]; then
  echo "→ Upload Hetzner Storage Box"
  rsync -avz --partial-dir=.partial "${WORK_DIR}/${BACKUP_NAME}" \
    "${HETZNER_STORAGE_USER}@${HETZNER_STORAGE_HOST}:/backups/redis/${BACKUP_TYPE}/${BACKUP_NAME}" \
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
echo "✅ Backup Redis OK : ${REMOTE_KEY} (${SIZE_HUMAN})"
