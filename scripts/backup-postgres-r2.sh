#!/usr/bin/env bash
# Backup Postgres chiffré → Cloudflare R2 (off-site, S3-compatible).
#
# Stratégie complémentaire des Hetzner Backups Auto natifs :
# - Hetzner Backups = recovery rapide whole-VPS (~10 min restore)
# - R2 backup    = redondance off-site (cas où Hetzner a un major incident)
#
# Pipeline :
#   1. pg_dump --format=custom (fichier .dump compact, restorable via pg_restore)
#   2. gzip --best (compression supplémentaire ~3-5x)
#   3. openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE
#   4. aws s3 cp ... s3://$R2_BUCKET/postgres/{type}/{filename} via R2 endpoint
#   5. rm fichier local (zero local storage retained)
#   6. liste & supprime backups au-delà de la rétention par type
#
# Variables requises :
#   DATABASE_URL                  Postgres URL (pg_dump source)
#   BACKUP_ENCRYPTION_PASSPHRASE  AES-256 (32+ chars random)
#   R2_ACCOUNT_ID                 Cloudflare account ID
#   R2_ACCESS_KEY_ID              R2 token Access Key
#   R2_SECRET_ACCESS_KEY          R2 token Secret Key
#   R2_BUCKET_NAME                bucket (ex: axion-ia-backups)
#   R2_ENDPOINT                   https://<account>.r2.cloudflarestorage.com
#   TELEGRAM_BOT_TOKEN            (optionnel) bot pour alertes
#   TELEGRAM_CHAT_ID              (optionnel) chat ID alertes
#
# Usage :
#   bash scripts/backup-postgres-r2.sh                   # daily auto
#   bash scripts/backup-postgres-r2.sh --type weekly
#   bash scripts/backup-postgres-r2.sh --type monthly
#   bash scripts/backup-postgres-r2.sh --restore <key>   # download + decrypt to /tmp
#
# Dépendances runtime (alpine-friendly) :
#   pg_dump, openssl, gzip, aws-cli (ou rclone si préféré)
#
# Cron sur VPS Hetzner (via Coolify Terminal `crontab -e`) :
#   0 3 * * *  bash /opt/axion-ia/scripts/backup-postgres-r2.sh
#   0 4 * * 0  bash /opt/axion-ia/scripts/backup-postgres-r2.sh --type weekly
#   0 5 1 * *  bash /opt/axion-ia/scripts/backup-postgres-r2.sh --type monthly

set -euo pipefail

# ─── Lib commune (ADR 0032) : ajoute healthcheck_ping + report_backup_run. ────
# Sourcée en tête → les helpers locaux définis plus bas restent prioritaires.
COMPONENT="postgres"
COMPONENT_LABEL="POSTGRES-R2"
FAIL_COUNT_FILE="/var/log/backup-fails-r2-count.log"   # préserve le chemin historique
# shellcheck source=scripts/backup-lib.sh
source "$(dirname "$0")/backup-lib.sh" 2>/dev/null || true

# ─── Configuration ───────────────────────────────────────────────────────────

BACKUP_TYPE="${BACKUP_TYPE:-daily}"
case "${1:-}" in
  --type) BACKUP_TYPE="${2:-daily}" ;;
  --restore) RESTORE_KEY="${2:?--restore needs an object key}" ;;
  daily|weekly|monthly) BACKUP_TYPE="$1" ;;
esac

DATE_TAG="$(date -u +%Y%m%d-%H%M%S)"
HOSTNAME_TAG="$(hostname -s 2>/dev/null || echo unknown)"
WORK_DIR="$(mktemp -d -t axion-ia-backup-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

BACKUP_NAME="axion-ia-pg-${BACKUP_TYPE}-${DATE_TAG}-${HOSTNAME_TAG}.dump.gz.enc"
LOCAL_PATH="${WORK_DIR}/${BACKUP_NAME}"
REMOTE_KEY="postgres/${BACKUP_TYPE}/${BACKUP_NAME}"

case "${BACKUP_TYPE}" in
  daily)   RETENTION_COUNT=7  ;;
  weekly)  RETENTION_COUNT=4  ;;
  monthly) RETENTION_COUNT=12 ;;
  *) echo "❌ Type inconnu : ${BACKUP_TYPE} (daily|weekly|monthly)"; exit 1 ;;
esac

# ─── Helpers ─────────────────────────────────────────────────────────────────

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "❌ Variable requise manquante : ${name}"
    record_fail "missing_var:${name}"
    exit 1
  fi
}

# ─── Anti-spam fail consécutifs (cf. audit D5+D6 P1-9) ──────────────────────
FAIL_COUNT_FILE="${FAIL_COUNT_FILE:-/var/log/backup-fails-r2-count.log}"

record_fail() {
  local reason="$1"
  mkdir -p "$(dirname "${FAIL_COUNT_FILE}")" 2>/dev/null || true
  local count=$(cat "${FAIL_COUNT_FILE}" 2>/dev/null || echo 0)
  count=$((count + 1))
  echo "${count}" > "${FAIL_COUNT_FILE}"
  if [ "${count}" -ge 2 ]; then
    notify_telegram "🔴🔴 [BACKUP-R2] CASCADING FAIL — ${count} backups R2 consécutifs échoués (raison : ${reason})"
  fi
}

record_success() {
  if [ -f "${FAIL_COUNT_FILE}" ]; then
    local count=$(cat "${FAIL_COUNT_FILE}" 2>/dev/null || echo 0)
    if [ "${count}" -ge 1 ]; then
      notify_telegram "🟢 [BACKUP-R2] Recovery OK après ${count} échecs consécutifs"
    fi
    rm -f "${FAIL_COUNT_FILE}"
  fi
}

notify_telegram() {
  local msg="$1"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -fsSL -m 10 -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=${msg}" \
      -d "parse_mode=Markdown" >/dev/null 2>&1 || true
  fi
}

s3() {
  # Wrapper aws-cli avec endpoint R2 + region auto. Utilise les standard
  # AWS env vars pour les creds (AWS_ACCESS_KEY_ID/SECRET) qu'on map depuis R2_*.
  # AWS_PAGER="" désactive le pager (équivalent --cli-pager= en v2 mais
  # compatible aws-cli v1 du repo Alpine, qui ne reconnaît pas le flag).
  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
    AWS_REGION="auto" \
    AWS_PAGER="" \
    aws --endpoint-url "${R2_ENDPOINT}" "$@"
}

# ─── Mode restore ────────────────────────────────────────────────────────────

if [ -n "${RESTORE_KEY:-}" ]; then
  require_var DATABASE_URL
  require_var BACKUP_ENCRYPTION_PASSPHRASE
  require_var R2_ACCESS_KEY_ID
  require_var R2_SECRET_ACCESS_KEY
  require_var R2_BUCKET_NAME
  require_var R2_ENDPOINT

  PG_URL_CLEAN="${DIRECT_URL%%\?*}"
  [ -z "$PG_URL_CLEAN" ] && PG_URL_CLEAN="${DATABASE_URL%%\?*}"

  echo "→ Mode restore depuis : s3://${R2_BUCKET_NAME}/${RESTORE_KEY}"
  s3 s3 cp "s3://${R2_BUCKET_NAME}/${RESTORE_KEY}" "${WORK_DIR}/restore.enc"
  echo "→ Decrypt + decompress"
  openssl enc -d -aes-256-cbc -pbkdf2 -salt \
    -pass "env:BACKUP_ENCRYPTION_PASSPHRASE" \
    -in "${WORK_DIR}/restore.enc" -out "${WORK_DIR}/restore.dump.gz"
  gunzip "${WORK_DIR}/restore.dump.gz"
  echo "→ Test pg_restore --list (validates dump integrity, no DB write)"
  pg_restore --list "${WORK_DIR}/restore.dump" | head -20
  echo
  echo "✅ Dump valide. Pour restorer pour de vrai dans la DB cible :"
  echo "   pg_restore --clean --if-exists --no-owner --dbname=\"${PG_URL_CLEAN}\" ${WORK_DIR}/restore.dump"
  exit 0
fi

# ─── Mode backup ─────────────────────────────────────────────────────────────

require_var DATABASE_URL
require_var BACKUP_ENCRYPTION_PASSPHRASE
require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY
require_var R2_BUCKET_NAME
require_var R2_ENDPOINT

# pg_dump n'accepte pas les params Prisma (?schema=, ?connection_limit=,
# ?pool_timeout=). On utilise DIRECT_URL si dispo (déjà sans pool params),
# sinon on strip les params problématiques de DATABASE_URL.
PG_URL="${DIRECT_URL:-$DATABASE_URL}"
# Strip tous les query params (le seul param utile pour pg_dump serait
# sslmode= ou similar que Prisma met aussi mais c'est rare en interne docker)
PG_URL_CLEAN="${PG_URL%%\?*}"

echo "→ Backup ${BACKUP_TYPE} : ${BACKUP_NAME}"
echo "→ pg_dump → gzip → encrypt"
pg_dump --format=custom --no-owner --no-acl "${PG_URL_CLEAN}" \
  | gzip --best \
  | openssl enc -aes-256-cbc -salt -pbkdf2 \
      -pass "env:BACKUP_ENCRYPTION_PASSPHRASE" \
      -out "${LOCAL_PATH}"

SIZE_HUMAN=$(du -h "${LOCAL_PATH}" | cut -f1)
SIZE_BYTES=$(stat -c%s "${LOCAL_PATH}" 2>/dev/null || echo null)
echo "→ Taille chiffrée : ${SIZE_HUMAN}"

echo "→ Upload R2 : ${REMOTE_KEY}"
s3 s3 cp "${LOCAL_PATH}" "s3://${R2_BUCKET_NAME}/${REMOTE_KEY}" \
  --metadata "type=${BACKUP_TYPE},date=${DATE_TAG},host=${HOSTNAME_TAG}"

# ─── Rétention ───────────────────────────────────────────────────────────────

echo "→ Pruning (rétention ${RETENTION_COUNT} ${BACKUP_TYPE})"
ALL=$(s3 s3 ls "s3://${R2_BUCKET_NAME}/postgres/${BACKUP_TYPE}/" | awk '{print $4}' | sort -r)
COUNT=0
while IFS= read -r KEY; do
  [ -z "${KEY}" ] && continue
  COUNT=$((COUNT + 1))
  if [ "${COUNT}" -gt "${RETENTION_COUNT}" ]; then
    echo "  delete: postgres/${BACKUP_TYPE}/${KEY}"
    s3 s3 rm "s3://${R2_BUCKET_NAME}/postgres/${BACKUP_TYPE}/${KEY}" || true
  fi
done <<< "${ALL}"

record_success
report_backup_run "success" "${SIZE_BYTES}" "null" "r2" "${REMOTE_KEY}" 2>/dev/null || true
healthcheck_ping 2>/dev/null || true
echo "✅ Backup OK : ${REMOTE_KEY} (${SIZE_HUMAN})"
notify_telegram "✅ Backup ${BACKUP_TYPE} OK · ${SIZE_HUMAN} · ${BACKUP_NAME}"
