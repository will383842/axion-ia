#!/usr/bin/env bash
# Test mensuel restauration backup Postgres (Sprint 23 / M11).
#
# Doctrine §15 + dossier v10.1 doc 09 :
#   "Test mensuel obligatoire restoration. Sans test → backup ≠ backup."
#
# Workflow :
#   1. Spin up Postgres test container vide
#   2. Download le dernier backup mensuel depuis Hetzner Storage Box
#   3. Déchiffre + décompresse + psql restore
#   4. Vérifie row count tables critiques (admins, bookings, articles…)
#   5. Cleanup container + notify Telegram
#
# Cron :
#   0 6 1 * *  bash /var/www/axion-ia/axionia/scripts/restore-postgres-test.sh

set -euo pipefail

require_env() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    echo "❌ Variable d'environnement requise : ${var}"
    exit 1
  fi
}

notify_telegram() {
  local message="$1"
  local emoji="${2:-🔵}"
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "parse_mode=HTML" \
      -d "text=${emoji} <b>[BACKUP-TEST]</b> ${message}" > /dev/null || true
  fi
}

require_env BACKUP_ENCRYPTION_PASSPHRASE
require_env HETZNER_STORAGE_USER
require_env HETZNER_STORAGE_HOST

TEST_PG_PORT="${TEST_PG_PORT:-5439}"
TEST_PG_PASSWORD="$(openssl rand -hex 16)"
TEST_CONTAINER_NAME="axion-ia-pg-restore-test"
TMP_DIR="/tmp/axion-ia-restore-test-$$"
mkdir -p "${TMP_DIR}"

cleanup() {
  echo "🧹 Cleanup…"
  docker rm -f "${TEST_CONTAINER_NAME}" > /dev/null 2>&1 || true
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

# 1. Téléchargement dernier monthly
echo "▶ Téléchargement dernier monthly backup…"
LATEST_MONTHLY=$(ssh "${HETZNER_STORAGE_USER}@${HETZNER_STORAGE_HOST}" \
  "ls -t /backups/postgres/monthly/axion-ia-pg-monthly-*.sql.gz.enc 2>/dev/null | head -1")

if [[ -z "${LATEST_MONTHLY}" ]]; then
  echo "❌ Aucun monthly backup trouvé"
  notify_telegram "Aucun monthly backup à tester !" "🔴"
  exit 1
fi

echo "  Backup ciblé : ${LATEST_MONTHLY}"
rsync -avz "${HETZNER_STORAGE_USER}@${HETZNER_STORAGE_HOST}:${LATEST_MONTHLY}" \
  "${TMP_DIR}/backup.sql.gz.enc"

# 2. Spin up Postgres test container
echo "▶ Démarrage Postgres test container (port ${TEST_PG_PORT})…"
docker run -d \
  --name "${TEST_CONTAINER_NAME}" \
  -e POSTGRES_PASSWORD="${TEST_PG_PASSWORD}" \
  -e POSTGRES_DB=axion_ia_restore_test \
  -p "${TEST_PG_PORT}:5432" \
  postgres:16-alpine > /dev/null

# Wait readiness
for i in {1..30}; do
  if docker exec "${TEST_CONTAINER_NAME}" pg_isready -U postgres > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# 3. Décrypte + restaure
echo "▶ Déchiffrement + restauration…"
START_TS=$(date +%s)

openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
  -in "${TMP_DIR}/backup.sql.gz.enc" \
  -pass "pass:${BACKUP_ENCRYPTION_PASSPHRASE}" \
  | gunzip > "${TMP_DIR}/backup.sql"

PGPASSWORD="${TEST_PG_PASSWORD}" psql \
  -h localhost -p "${TEST_PG_PORT}" \
  -U postgres -d axion_ia_restore_test \
  < "${TMP_DIR}/backup.sql" > "${TMP_DIR}/restore.log" 2>&1

DURATION=$(( $(date +%s) - START_TS ))

# 4. Vérifications row counts tables critiques
echo "▶ Vérifications row counts…"
declare -A counts
TABLES=(admin_users bookings_options bookings_simple articles testimonials case_studies faqs)

for table in "${TABLES[@]}"; do
  count=$(PGPASSWORD="${TEST_PG_PASSWORD}" psql \
    -h localhost -p "${TEST_PG_PORT}" \
    -U postgres -d axion_ia_restore_test \
    -tAc "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "ERROR")
  counts[$table]=$count
  echo "  ${table} : ${count}"
done

# 5. Heuristic check : si TOUTES tables = 0 ou ERROR → backup probable corrompu
TOTAL=0
for v in "${counts[@]}"; do
  if [[ "$v" =~ ^[0-9]+$ ]]; then
    TOTAL=$((TOTAL + v))
  fi
done

if [[ "${TOTAL}" -lt 10 ]]; then
  echo "❌ Backup probable corrompu (total rows < 10)"
  notify_telegram "Restore test ÉCHEC — backup probable corrompu (rows=${TOTAL})" "🔴"
  exit 1
fi

# 6. OK
SUMMARY=$(printf "%s=%s, " "${!counts[@]}" "${counts[@]}" | sed 's/, $//')
notify_telegram "Restore test OK en ${DURATION}s. ${SUMMARY}" "🟢"
echo "✅ Restore test OK en ${DURATION}s. Total rows critiques = ${TOTAL}"
