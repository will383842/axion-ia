#!/usr/bin/env bash
# Test mensuel restauration backup Postgres depuis Cloudflare R2.
#
# Variante CI/CD du `restore-postgres-test.sh` (qui pull depuis Hetzner
# Storage Box via SSH). Utilisé par `.github/workflows/nightly.yml` job
# `backup-drill` qui ne peut pas SSH le VPS.
#
# Doctrine §15 + dossier v10.1 doc 09 :
#   "Test mensuel obligatoire restoration. Sans test → backup ≠ backup."
#
# Workflow :
#   1. Liste les backups daily R2 via aws-cli S3-compatible
#   2. Télécharge le plus récent
#   3. Déchiffre AES-256 + décompresse + pg_restore
#   4. Vérifie que `pg_restore --list` parse sans erreur (intégrité)
#   5. Restore dans la DB cible (DATABASE_URL_TEST si fournie, sinon stdout/parse only)
#   6. Vérifie row count tables critiques (best-effort, échec table = warn pas fail)
#   7. Telegram notify succès/échec
#
# Variables requises :
#   R2_ACCESS_KEY_ID              Cloudflare R2 token Access Key
#   R2_SECRET_ACCESS_KEY          Cloudflare R2 token Secret Key
#   R2_ENDPOINT                   https://<account>.r2.cloudflarestorage.com
#   R2_BUCKET_NAME                bucket (ex: axion-ia-backups)
#   BACKUP_ENCRYPTION_PASSPHRASE  AES-256 passphrase (identique à celle qui a chiffré le dump)
#   DATABASE_URL_TEST             (optionnel) Postgres jetable pour tester restore réel
#                                 Si absent, on s'arrête après pg_restore --list (intégrité OK)
#   TELEGRAM_BOT_TOKEN            (optionnel) bot pour alertes
#   TELEGRAM_CHAT_ID              (optionnel) chat ID alertes
#
# Cron CI : `.github/workflows/nightly.yml` à 03:00 UTC daily.

set -euo pipefail

# ─── Helpers ─────────────────────────────────────────────────────────────────

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "❌ Variable requise manquante : ${name}" >&2
    exit 1
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
  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
    AWS_REGION="auto" \
    AWS_PAGER="" \
    aws --endpoint-url "${R2_ENDPOINT}" "$@"
}

require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY
require_var R2_ENDPOINT
require_var R2_BUCKET_NAME
require_var BACKUP_ENCRYPTION_PASSPHRASE

WORK_DIR="$(mktemp -d -t axion-ia-restore-test-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

# ─── 1. Lister les backups daily disponibles ─────────────────────────────────

echo "▶ Listing R2 daily backups…"
LATEST_KEY=$(s3 s3 ls "s3://${R2_BUCKET_NAME}/postgres/daily/" \
  | awk '{print $4}' \
  | grep -E '^axion-ia-pg-daily-.*\.dump\.gz\.enc$' \
  | sort -r \
  | head -1)

if [ -z "${LATEST_KEY}" ]; then
  echo "❌ Aucun backup daily trouvé sur R2"
  notify_telegram "🔴 [BACKUP-TEST-R2] Aucun daily à tester !"
  exit 1
fi

REMOTE_PATH="postgres/daily/${LATEST_KEY}"
echo "  Backup ciblé : ${REMOTE_PATH}"

# ─── 2. Télécharger ──────────────────────────────────────────────────────────

echo "▶ Download…"
START_TS=$(date +%s)
s3 s3 cp "s3://${R2_BUCKET_NAME}/${REMOTE_PATH}" "${WORK_DIR}/backup.enc"
DL_DURATION=$(( $(date +%s) - START_TS ))
SIZE_BYTES=$(stat -c%s "${WORK_DIR}/backup.enc" 2>/dev/null || stat -f%z "${WORK_DIR}/backup.enc")
SIZE_MB=$(( SIZE_BYTES / 1024 / 1024 ))
echo "  Téléchargé : ${SIZE_MB} MB en ${DL_DURATION}s"

# ─── 3. Decrypt + decompress ─────────────────────────────────────────────────

echo "▶ Decrypt + decompress…"
openssl enc -d -aes-256-cbc -pbkdf2 -salt \
  -pass "env:BACKUP_ENCRYPTION_PASSPHRASE" \
  -in "${WORK_DIR}/backup.enc" -out "${WORK_DIR}/backup.dump.gz"
gunzip "${WORK_DIR}/backup.dump.gz"
DUMP_SIZE_MB=$(( $(stat -c%s "${WORK_DIR}/backup.dump" 2>/dev/null || stat -f%z "${WORK_DIR}/backup.dump") / 1024 / 1024 ))
echo "  Dump déchiffré : ${DUMP_SIZE_MB} MB"

# ─── 4. Test intégrité pg_restore --list ─────────────────────────────────────

echo "▶ pg_restore --list (intégrité)…"
LIST_LINES=$(pg_restore --list "${WORK_DIR}/backup.dump" 2>&1 | wc -l)
if [ "${LIST_LINES}" -lt 10 ]; then
  echo "❌ pg_restore --list a moins de 10 lignes (${LIST_LINES}) — dump probablement corrompu"
  notify_telegram "🔴 [BACKUP-TEST-R2] Dump probable corrompu (list=${LIST_LINES} lignes)"
  exit 1
fi
echo "  pg_restore --list : ${LIST_LINES} entrées (intégrité OK)"

# ─── 5. Restore réel (si DATABASE_URL_TEST fourni) ───────────────────────────

if [ -z "${DATABASE_URL_TEST:-}" ]; then
  echo "ℹ DATABASE_URL_TEST non fourni — drill arrêté après check intégrité."
  TOTAL_DURATION=$(( $(date +%s) - START_TS ))
  notify_telegram "🟢 [BACKUP-TEST-R2] Intégrité OK (${SIZE_MB} MB, ${LIST_LINES} entrées) en ${TOTAL_DURATION}s · pas de DB test, drill = parse only"
  echo "✅ Drill OK (intégrité only) en ${TOTAL_DURATION}s"
  exit 0
fi

echo "▶ pg_restore vers DATABASE_URL_TEST…"
RESTORE_START=$(date +%s)
# --no-owner --no-acl pour éviter les erreurs sur rôles/permissions absents en CI
# --clean --if-exists pour idempotence (si DB déjà partiellement remplie)
pg_restore \
  --clean --if-exists \
  --no-owner --no-acl \
  --dbname="${DATABASE_URL_TEST}" \
  "${WORK_DIR}/backup.dump" \
  > "${WORK_DIR}/restore.log" 2>&1 || {
    RC=$?
    echo "⚠️ pg_restore exit ${RC} (warnings normaux sur extensions). Inspect :"
    tail -30 "${WORK_DIR}/restore.log"
    # On continue — pg_restore retourne souvent non-zero pour des warnings
    # bénins (extension already exists, role missing). Le critère réel = counts.
  }
RESTORE_DURATION=$(( $(date +%s) - RESTORE_START ))
echo "  pg_restore : ${RESTORE_DURATION}s"

# ─── 6. Vérification row counts tables critiques ─────────────────────────────

echo "▶ Row counts tables critiques…"
declare -A counts
# Liste alignée avec le restore-postgres-test.sh historique (Storage Box variant)
# + tables content-gen P0 (Article, KnowledgeEntry) cf. ADR 0023.
TABLES=(
  "\"Article\""
  "\"KnowledgeEntry\""
  "\"Booking\""
  "\"AuthorProfile\""
)

TOTAL=0
for tbl in "${TABLES[@]}"; do
  count=$(psql "${DATABASE_URL_TEST}" -tAc "SELECT COUNT(*) FROM ${tbl};" 2>/dev/null || echo "ERROR")
  counts[$tbl]=$count
  echo "  ${tbl} : ${count}"
  if [[ "$count" =~ ^[0-9]+$ ]]; then
    TOTAL=$((TOTAL + count))
  fi
done

# ─── 7. Heuristique : si total = 0 → backup probable corrompu ────────────────

if [ "${TOTAL}" -lt 1 ]; then
  echo "❌ Total rows critiques = 0 (probable corruption ou DB vide)"
  notify_telegram "🔴 [BACKUP-TEST-R2] ÉCHEC counts (total=${TOTAL}) — backup probable corrompu"
  exit 1
fi

# ─── 8. OK ───────────────────────────────────────────────────────────────────

TOTAL_DURATION=$(( $(date +%s) - START_TS ))
SUMMARY=$(printf "%s=%s, " "${!counts[@]}" "${counts[@]}" | sed 's/, $//')
notify_telegram "🟢 [BACKUP-TEST-R2] OK en ${TOTAL_DURATION}s (${SIZE_MB} MB) · total rows critiques=${TOTAL}"
echo "✅ Drill OK en ${TOTAL_DURATION}s. Total rows critiques = ${TOTAL}"
