#!/usr/bin/env bash
# backup-lib.sh — Bibliothèque commune des scripts de backup Axion-IA (ADR 0032).
#
# À SOURCER en tête de chaque script backup-*.sh :
#   COMPONENT="redis"          # enum BackupComponent (Prisma) : voir liste plus bas
#   COMPONENT_LABEL="REDIS"    # label court pour Telegram / Healthchecks
#   source "$(dirname "$0")/backup-lib.sh"
#
# Fournit : notify_telegram, require_var, record_fail/record_success (anti-spam
# cascading par composant), s3() (wrapper R2), encrypt_aes/decrypt_aes,
# healthcheck_ping (dead-man's-switch), report_backup_run / report_restore_drill
# (POST HMAC best-effort vers /api/internal/backups*).
#
# Conventions calquées sur backup-postgres-r2.sh :
#   - chiffrement openssl aes-256-cbc -pbkdf2 -iter 100000 (homogène partout)
#   - GFS 7/4/12, naming axion-ia-<composant>-<type>-<date>-<host>
#   - tout helper best-effort (Telegram / Healthchecks / reporting) ne fait JAMAIS
#     échouer le backup (|| true).
#
# Composants (enum BackupComponent) : postgres postgres_pitr redis
#   files_image_bank files_documents files_utilisateurs docuseal plausible_pg
#   plausible_clickhouse secrets git_mirror
# ⚠️ Un composant par script. Deux scripts sous le même composant rendent la
# détection de retard aveugle : elle raisonne sur le DERNIER run, donc le cron
# survivant masque le cron mort. Gardé par
# `tests/unit/ci/sauvegardes-couvrent-le-bucket.spec.ts`.

# ─── Identité du script (overridable avant source) ───────────────────────────
COMPONENT="${COMPONENT:-unknown}"
COMPONENT_LABEL="${COMPONENT_LABEL:-${COMPONENT}}"
BACKUP_TYPE="${BACKUP_TYPE:-daily}"
DATE_TAG="${DATE_TAG:-$(date -u +%Y%m%d-%H%M%S)}"
HOSTNAME_TAG="${HOSTNAME_TAG:-$(hostname -s 2>/dev/null || echo unknown)}"

# Compteur fails consécutifs propre à chaque composant.
#
# ⚠️ Deux défauts fermés ici le 2026-09-03, l'un et l'autre rendaient l'alerte
# « CASCADING FAIL » inatteignable :
#
#  1. Les wrappers `vps/run-*.sh` exécutent tout dans un conteneur ÉPHÉMÈRE. Le
#     compteur naissait et mourait avec lui : il repartait de zéro à chaque run,
#     donc il n'atteignait jamais 2. D'où `FAIL_COUNT_DIR`, que les wrappers
#     pointent sur un volume de l'hôte (`/var/lib/axion-backup`).
#  2. Le chemin était figé AU MOMENT DU `source`. `backup-plausible.sh` passe à
#     `COMPONENT="plausible_clickhouse"` APRÈS avoir sourcé : les échecs
#     ClickHouse incrémentaient donc le compteur de Postgres, et deux composants
#     partageaient un seul témoin. Le chemin est maintenant calculé à l'appel.
#
# `FAIL_COUNT_FILE` reste honoré s'il est posé explicitement (chemin unique,
# tous composants confondus) ; sinon un fichier par composant dans FAIL_COUNT_DIR.
FAIL_COUNT_DIR="${FAIL_COUNT_DIR:-/var/log}"
_fail_count_file() {
  if [ -n "${FAIL_COUNT_FILE:-}" ]; then
    printf '%s' "${FAIL_COUNT_FILE}"
  else
    printf '%s/backup-fails-%s-count.log' "${FAIL_COUNT_DIR}" "${COMPONENT}"
  fi
}

# ─── Telegram ────────────────────────────────────────────────────────────────
notify_telegram() {
  local message="$1"
  local emoji="${2:-🔵}"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -fsS -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "parse_mode=HTML" \
      -d "text=${emoji} <b>[BACKUP ${COMPONENT_LABEL}]</b> ${message}" >/dev/null 2>&1 || true
  fi
}

# ─── Variables requises ──────────────────────────────────────────────────────
require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "❌ Variable requise manquante : ${name}"
    record_fail "missing_var:${name}"
    exit 1
  fi
}

# ─── Anti-spam fail consécutifs (cf. audit D5+D6 P1-9) ───────────────────────
record_fail() {
  local reason="$1"
  local fichier
  fichier="$(_fail_count_file)"
  mkdir -p "$(dirname "${fichier}")" 2>/dev/null || true
  local count
  count=$(cat "${fichier}" 2>/dev/null || echo 0)
  count=$((count + 1))
  echo "${count}" > "${fichier}"
  CONSECUTIVE_FAILURES="${count}"
  if [ "${count}" -ge 2 ]; then
    notify_telegram "🔴🔴 CASCADING FAIL — ${count} backups consécutifs échoués (raison : ${reason}). Investigation P0." "🔴"
  else
    notify_telegram "Backup KO (${reason})" "🔴"
  fi
  healthcheck_ping "/fail"
}

record_success() {
  CONSECUTIVE_FAILURES=0
  local fichier
  fichier="$(_fail_count_file)"
  if [ -f "${fichier}" ]; then
    local count
    count=$(cat "${fichier}" 2>/dev/null || echo 0)
    if [ "${count}" -ge 1 ]; then
      notify_telegram "🟢 Recovery OK après ${count} échecs consécutifs" "🟢"
    fi
    rm -f "${fichier}"
  fi
}

# ─── Wrapper aws-cli endpoint R2 ─────────────────────────────────────────────
# Map R2_* → AWS_* standard env vars. AWS_PAGER="" pour compat aws-cli v1 Alpine.
s3() {
  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
    AWS_REGION="auto" \
    AWS_PAGER="" \
    aws --endpoint-url "${R2_ENDPOINT}" "$@"
}

# ─── Chiffrement AES-256 (homogène iter 100000) ──────────────────────────────
encrypt_aes() {  # stdin → stdout
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -pass "env:BACKUP_ENCRYPTION_PASSPHRASE"
}

decrypt_aes() {  # stdin → stdout
  openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -pass "env:BACKUP_ENCRYPTION_PASSPHRASE"
}

# ─── Upload R2 avec Object Lock optionnel ────────────────────────────────────
# upload_r2 <local_path> <bucket> <key> [immutable] [retain_days]
# Si "immutable" + R2_BUCKET_IMMUTABLE : put-object avec COMPLIANCE retain.
upload_r2() {
  local local_path="$1" bucket="$2" key="$3" immutable="${4:-}" retain_days="${5:-35}"
  if [ "${immutable}" = "immutable" ]; then
    local until
    until="$(date -u -d "+${retain_days} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
      || date -u -v "+${retain_days}d" +%Y-%m-%dT%H:%M:%SZ)"
    s3 s3api put-object \
      --bucket "${bucket}" \
      --key "${key}" \
      --body "${local_path}" \
      --object-lock-mode COMPLIANCE \
      --object-lock-retain-until-date "${until}" >/dev/null
  else
    s3 s3 cp "${local_path}" "s3://${bucket}/${key}" \
      --metadata "type=${BACKUP_TYPE},date=${DATE_TAG},host=${HOSTNAME_TAG},component=${COMPONENT}"
  fi
}

# ─── Rotation GFS sur préfixe R2 (no-op si Object Lock refuse rm) ─────────────
prune_r2() {  # <bucket> <prefix/> <retention_count>
  local bucket="$1" prefix="$2" retention="$3"
  local all count=0
  all=$(s3 s3 ls "s3://${bucket}/${prefix}" 2>/dev/null | awk '{print $4}' | sort -r || true)
  while IFS= read -r key; do
    [ -z "${key}" ] && continue
    count=$((count + 1))
    if [ "${count}" -gt "${retention}" ]; then
      # Sous Object Lock, rm est refusé : on ignore (la rétention = expiration du lock).
      s3 s3 rm "s3://${bucket}/${prefix}${key}" >/dev/null 2>&1 || true
    fi
  done <<< "${all}"
}

retention_for_type() {  # echo le RETENTION_COUNT selon BACKUP_TYPE
  case "${1:-daily}" in
    daily)   echo 7  ;;
    weekly)  echo 4  ;;
    monthly) echo 12 ;;
    *)       echo 7  ;;
  esac
}

# ─── Healthchecks.io (dead-man's-switch) ─────────────────────────────────────
# URL résolue dans cet ordre : HEALTHCHECK_URL_<COMPONENT_UPPER> puis HEALTHCHECK_URL.
healthcheck_ping() {  # [suffix] ex "/start" | "/fail" | "" (succès)
  local suffix="${1:-}"
  local upper var url
  upper="$(echo "${COMPONENT}" | tr '[:lower:]' '[:upper:]')"
  var="HEALTHCHECK_URL_${upper}"
  url="${!var:-${HEALTHCHECK_URL:-}}"
  [ -z "${url}" ] && return 0
  curl -fsS -m 10 "${url}${suffix}" >/dev/null 2>&1 || true
}

# ─── Reporting HMAC vers l'admin (BackupRun / RestoreDrill) ──────────────────
# Signature = HMAC-SHA256(body, BACKUP_INGEST_SECRET) hex — cf. src/lib/backups/hmac.ts.
_hmac_hex() {  # <body> → hex digest sur stdout
  printf '%s' "$1" | openssl dgst -sha256 -hmac "${BACKUP_INGEST_SECRET:-}" 2>/dev/null \
    | sed 's/^.*= //'
}

_uuid_v4() {
  if [ -r /proc/sys/kernel/random/uuid ]; then
    cat /proc/sys/kernel/random/uuid
  else
    # fallback openssl
    openssl rand -hex 16 | sed -E 's/(........)(....)(....)(....)(............)/\1-\2-4\3-8\4-\5/'
  fi
}

# report_backup_run <status> <sizeBytes|null> <durationSec|null> <destination> <remotePath|""> [failReason|""]
report_backup_run() {
  [ -z "${BACKUP_REPORT_URL:-}" ] && return 0
  [ -z "${BACKUP_INGEST_SECRET:-}" ] && return 0
  local status="$1" size="${2:-null}" dur="${3:-null}" dest="$4" remote="${5:-}" reason="${6:-}"
  local consec="${CONSECUTIVE_FAILURES:-0}"
  local reason_json="null"; [ -n "${reason}" ] && reason_json="\"${reason//\"/\'}\""
  local remote_json="null"; [ -n "${remote}" ] && remote_json="\"${remote//\"/\'}\""
  local body
  body=$(printf '{"component":"%s","kind":"%s","status":"%s","startedAt":"%s","sizeBytes":%s,"durationSec":%s,"destination":"%s","remotePath":%s,"failReason":%s,"consecutiveFailures":%s,"source":"%s","hostname":"%s"}' \
    "${COMPONENT}" "${BACKUP_TYPE}" "${status}" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${size}" "${dur}" "${dest}" \
    "${remote_json}" "${reason_json}" "${consec}" "${BACKUP_SOURCE:-cron_vps}" "${HOSTNAME_TAG}")
  curl -fsS -m 10 -X POST "${BACKUP_REPORT_URL%/}/api/internal/backups" \
    -H "Content-Type: application/json" \
    -H "X-Backup-Signature: $(_hmac_hex "${body}")" \
    -H "X-Idempotency-Key: $(_uuid_v4)" \
    --data "${body}" >/dev/null 2>&1 || true
}

# report_restore_drill <status> <rowsChecked|null> <durationSec|null> <source> <backupRef|""> [failReason|""]
report_restore_drill() {
  [ -z "${BACKUP_REPORT_URL:-}" ] && return 0
  [ -z "${BACKUP_INGEST_SECRET:-}" ] && return 0
  local status="$1" rows="${2:-null}" dur="${3:-null}" src="$4" ref="${5:-}" reason="${6:-}"
  local reason_json="null"; [ -n "${reason}" ] && reason_json="\"${reason//\"/\'}\""
  local ref_json="null"; [ -n "${ref}" ] && ref_json="\"${ref//\"/\'}\""
  local body
  body=$(printf '{"component":"%s","status":"%s","startedAt":"%s","verifiedRows":%s,"durationSec":%s,"source":"%s","backupRef":%s,"failReason":%s}' \
    "${COMPONENT}" "${status}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${rows}" "${dur}" \
    "${src}" "${ref_json}" "${reason_json}")
  curl -fsS -m 10 -X POST "${BACKUP_REPORT_URL%/}/api/internal/backups/drills" \
    -H "Content-Type: application/json" \
    -H "X-Backup-Signature: $(_hmac_hex "${body}")" \
    -H "X-Idempotency-Key: $(_uuid_v4)" \
    --data "${body}" >/dev/null 2>&1 || true
}
