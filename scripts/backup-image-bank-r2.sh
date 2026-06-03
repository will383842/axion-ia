#!/usr/bin/env bash
# Backup fichiers image-bank → copie off-provider R2 (ADR 0032).
#
# 🔴 P0 : aujourd'hui les originaux vivent en 1 seule copie (volume VPS /
# Storage Box = "prod"). Ce script crée la copie hors-Hetzner.
#
# Deux modes :
#   --mode mirror   (défaut) : aws s3 sync incrémental → reflète la source, RPO court
#   --mode archive           : tar chiffré horodaté GFS → copie point-in-time (immuable si monthly)
#
# Variables requises :
#   IMAGE_BANK_STORAGE_PATH (défaut /var/data/image-bank)
#   R2_* (BUCKET_NAME/ENDPOINT/keys)
#   BACKUP_ENCRYPTION_PASSPHRASE (mode archive uniquement)
# Optionnel : R2_BUCKET_IMMUTABLE, TELEGRAM_*, HEALTHCHECK_URL_FILES_IMAGE_BANK, BACKUP_REPORT_*
#
# Usage :
#   bash scripts/backup-image-bank-r2.sh --mode mirror
#   bash scripts/backup-image-bank-r2.sh --mode archive --type monthly

set -euo pipefail

COMPONENT="files_image_bank"
COMPONENT_LABEL="IMAGE-BANK"
MODE="mirror"
args=("$@")
for i in "${!args[@]}"; do
  case "${args[$i]}" in
    --mode) MODE="${args[$((i+1))]:-mirror}" ;;
    --type) BACKUP_TYPE="${args[$((i+1))]:-daily}" ;;
  esac
done
BACKUP_TYPE="${BACKUP_TYPE:-daily}"
source "$(dirname "$0")/backup-lib.sh"

IMAGE_BANK_STORAGE_PATH="${IMAGE_BANK_STORAGE_PATH:-/var/data/image-bank}"
RETENTION_COUNT="$(retention_for_type "${BACKUP_TYPE}")"

healthcheck_ping "/start"
require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY
require_var R2_BUCKET_NAME
require_var R2_ENDPOINT

if [ ! -d "${IMAGE_BANK_STORAGE_PATH}" ]; then
  echo "❌ Source introuvable : ${IMAGE_BANK_STORAGE_PATH}"
  record_fail "source_missing:${IMAGE_BANK_STORAGE_PATH}"
  exit 1
fi

START_TS=$(date +%s)

if [ "${MODE}" = "mirror" ]; then
  echo "→ s3 sync incrémental → R2 (image-bank/live/)"
  s3 s3 sync "${IMAGE_BANK_STORAGE_PATH}/" "s3://${R2_BUCKET_NAME}/image-bank/live/" --delete \
    || { record_fail "s3_sync_failed"; exit 1; }
  SIZE_BYTES=$(du -sb "${IMAGE_BANK_STORAGE_PATH}" | cut -f1)
  SIZE_HUMAN=$(du -sh "${IMAGE_BANK_STORAGE_PATH}" | cut -f1)
  REMOTE_KEY="image-bank/live/"
  DEST="r2"
else
  echo "→ Archive tar chiffrée horodatée (${BACKUP_TYPE})"
  require_var BACKUP_ENCRYPTION_PASSPHRASE
  WORK_DIR="$(mktemp -d -t axion-ia-imagebank-XXXXXX)"
  trap 'rm -rf "${WORK_DIR}"' EXIT
  BACKUP_NAME="axion-ia-imagebank-${BACKUP_TYPE}-${DATE_TAG}-${HOSTNAME_TAG}.tar.gz.enc"
  tar -C "${IMAGE_BANK_STORAGE_PATH}" -cf - . | gzip -9 | encrypt_aes > "${WORK_DIR}/${BACKUP_NAME}"
  SIZE_BYTES=$(stat -c%s "${WORK_DIR}/${BACKUP_NAME}")
  SIZE_HUMAN=$(du -h "${WORK_DIR}/${BACKUP_NAME}" | cut -f1)
  REMOTE_KEY="image-bank/${BACKUP_TYPE}/${BACKUP_NAME}"
  if [ "${BACKUP_TYPE}" = "monthly" ] && [ -n "${R2_BUCKET_IMMUTABLE:-}" ]; then
    upload_r2 "${WORK_DIR}/${BACKUP_NAME}" "${R2_BUCKET_IMMUTABLE}" "${REMOTE_KEY}" immutable 400 \
      || { record_fail "r2_immutable_upload"; exit 1; }
    DEST="r2-immutable"
  else
    upload_r2 "${WORK_DIR}/${BACKUP_NAME}" "${R2_BUCKET_NAME}" "${REMOTE_KEY}" || { record_fail "r2_upload"; exit 1; }
    prune_r2 "${R2_BUCKET_NAME}" "image-bank/${BACKUP_TYPE}/" "${RETENTION_COUNT}"
    DEST="r2"
  fi
fi

DURATION=$(( $(date +%s) - START_TS ))
record_success
report_backup_run "success" "${SIZE_BYTES}" "${DURATION}" "${DEST}" "${REMOTE_KEY}"
healthcheck_ping
notify_telegram "OK ${MODE} ${BACKUP_TYPE} · ${SIZE_HUMAN} · ${DURATION}s" "🟢"
echo "✅ Backup image-bank OK (${MODE}) : ${REMOTE_KEY} (${SIZE_HUMAN})"
