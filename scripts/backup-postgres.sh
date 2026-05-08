#!/usr/bin/env bash
# Backup Postgres chiffré AES-256 → Hetzner Storage Box (Sprint 23 / M11).
#
# Doctrine §15 : "Test mensuel obligatoire restauration".
# Rétention : 7 quotidiens + 4 hebdomadaires + 12 mensuels.
#
# Variables requises :
#   - DATABASE_URL                  → Postgres source
#   - BACKUP_ENCRYPTION_PASSPHRASE  → AES-256 passphrase (32+ chars random)
#   - HETZNER_STORAGE_USER          → user@user.your-storagebox.de
#   - HETZNER_STORAGE_HOST          → user.your-storagebox.de
#   - TELEGRAM_BOT_TOKEN            → bot Telegram (alerts)
#   - TELEGRAM_CHAT_ID              → chat ID alerts ops
#
# Usage :
#   bash scripts/backup-postgres.sh                          (daily auto)
#   bash scripts/backup-postgres.sh --type weekly
#   bash scripts/backup-postgres.sh --type monthly
#   bash scripts/backup-postgres.sh --restore <filename>     (test restore)
#
# Cron (sur VPS Hetzner CPX32, via Coolify ou crontab) :
#   0 3 * * *  bash /var/www/axion-ia/axionia/scripts/backup-postgres.sh
#   0 4 * * 0  bash /var/www/axion-ia/axionia/scripts/backup-postgres.sh --type weekly
#   0 5 1 * *  bash /var/www/axion-ia/axionia/scripts/backup-postgres.sh --type monthly

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────

BACKUP_DIR="${BACKUP_DIR:-/tmp/axion-ia-backups}"
BACKUP_TYPE="${1:-daily}"
[[ "${1:-}" == "--type" ]] && BACKUP_TYPE="${2:-daily}"

DATE_TAG="$(date -u +%Y%m%d-%H%M%S)"
HOSTNAME_TAG="$(hostname -s)"
BACKUP_NAME="axion-ia-pg-${BACKUP_TYPE}-${DATE_TAG}-${HOSTNAME_TAG}.sql.gz.enc"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

REMOTE_PATH="/backups/postgres/${BACKUP_TYPE}/${BACKUP_NAME}"

# Retention policy par type
case "${BACKUP_TYPE}" in
  daily)   RETENTION_COUNT=7 ;;
  weekly)  RETENTION_COUNT=4 ;;
  monthly) RETENTION_COUNT=12 ;;
  *)       echo "❌ Type inconnu : ${BACKUP_TYPE} (daily|weekly|monthly)"; exit 1 ;;
esac

# ─── Helpers ─────────────────────────────────────────────────────────────────

notify_telegram() {
  local message="$1"
  local emoji="${2:-🔵}"
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "parse_mode=HTML" \
      -d "text=${emoji} <b>[BACKUP]</b> ${message}" > /dev/null || true
  fi
}

require_env() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    echo "❌ Variable d'environnement requise : ${var}"
    notify_telegram "Backup KO : ${var} manquante" "🔴"
    exit 1
  fi
}

# ─── Restore mode ────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--restore" ]]; then
  RESTORE_FILE="${2:?--restore <filename>}"
  echo "▶ Restore depuis ${RESTORE_FILE}…"
  require_env BACKUP_ENCRYPTION_PASSPHRASE
  require_env DATABASE_URL

  if [[ ! -f "${BACKUP_DIR}/${RESTORE_FILE}" ]]; then
    echo "  ⤓ Téléchargement Hetzner Storage Box…"
    require_env HETZNER_STORAGE_USER
    require_env HETZNER_STORAGE_HOST
    rsync -avz "${HETZNER_STORAGE_USER}@${HETZNER_STORAGE_HOST}:/backups/postgres/${BACKUP_TYPE}/${RESTORE_FILE}" \
      "${BACKUP_DIR}/${RESTORE_FILE}"
  fi

  echo "  🔓 Déchiffrement AES-256…"
  openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
    -in "${BACKUP_DIR}/${RESTORE_FILE}" \
    -pass "pass:${BACKUP_ENCRYPTION_PASSPHRASE}" \
    | gunzip > "${BACKUP_DIR}/restore.sql"

  echo "  ⏳ pg_restore…"
  psql "${DATABASE_URL}" < "${BACKUP_DIR}/restore.sql"

  rm -f "${BACKUP_DIR}/restore.sql"
  echo "✅ Restore terminé. Vérifier les données critiques."
  notify_telegram "Restore terminé depuis ${RESTORE_FILE}" "🟢"
  exit 0
fi

# ─── Backup mode ─────────────────────────────────────────────────────────────

echo "▶ Backup ${BACKUP_TYPE} → ${BACKUP_NAME}"

require_env DATABASE_URL
require_env BACKUP_ENCRYPTION_PASSPHRASE
require_env HETZNER_STORAGE_USER
require_env HETZNER_STORAGE_HOST

mkdir -p "${BACKUP_DIR}"

# 1. pg_dump → gzip → AES-256
echo "  📦 pg_dump + gzip + chiffrement AES-256…"
START_TS=$(date +%s)

# pg_dump format custom + gzip + openssl chiffrement passphrase
pg_dump "${DATABASE_URL}" \
    --no-owner \
    --no-privileges \
    --format=plain \
    --encoding=UTF-8 \
  | gzip -9 \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
      -pass "pass:${BACKUP_ENCRYPTION_PASSPHRASE}" \
      -out "${BACKUP_PATH}"

DURATION=$(( $(date +%s) - START_TS ))
SIZE_HUMAN=$(du -h "${BACKUP_PATH}" | cut -f1)
echo "  ✅ Dump local : ${SIZE_HUMAN} en ${DURATION}s"

# 2. Upload Hetzner Storage Box (rsync over SSH)
echo "  ⤴ Upload Hetzner Storage Box…"
rsync -avz --partial-dir=.partial \
  "${BACKUP_PATH}" \
  "${HETZNER_STORAGE_USER}@${HETZNER_STORAGE_HOST}:${REMOTE_PATH}"

# 3. Vérification taille remote == local (anti-corruption transit)
LOCAL_SIZE=$(stat -c%s "${BACKUP_PATH}")
REMOTE_SIZE=$(ssh "${HETZNER_STORAGE_USER}@${HETZNER_STORAGE_HOST}" "stat -c%s ${REMOTE_PATH}" 2>/dev/null || echo 0)
if [[ "${LOCAL_SIZE}" != "${REMOTE_SIZE}" ]]; then
  echo "❌ Taille remote ≠ local (${LOCAL_SIZE} vs ${REMOTE_SIZE})"
  notify_telegram "Backup ${BACKUP_TYPE} CORRUPTION transit (${LOCAL_SIZE}≠${REMOTE_SIZE})" "🔴"
  exit 1
fi

# 4. Rotation : on garde les N plus récents pour ce type
echo "  🗑  Rotation (garde ${RETENTION_COUNT} plus récents)…"
ssh "${HETZNER_STORAGE_USER}@${HETZNER_STORAGE_HOST}" "
  cd /backups/postgres/${BACKUP_TYPE} 2>/dev/null || exit 0
  ls -t axion-ia-pg-${BACKUP_TYPE}-*.sql.gz.enc 2>/dev/null | tail -n +$((RETENTION_COUNT + 1)) | xargs -r rm -f
"

# 5. Cleanup local (on n'a besoin que sur remote)
rm -f "${BACKUP_PATH}"

# 6. Telegram OK
notify_telegram "Backup ${BACKUP_TYPE} OK : ${SIZE_HUMAN} en ${DURATION}s → ${REMOTE_PATH}" "🟢"
echo "✅ Backup terminé."
