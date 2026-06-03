#!/usr/bin/env bash
# Backup secrets & config chiffré (age) → R2 immuable (ADR 0032).
#
# 🔴 P0 — angle mort "restore from cold" : un backup DB sans les secrets pour
# redéployer = restauration impossible. On archive :
#   - le dossier .secrets/ du VPS (creds Google, api-tokens, gsc-*.json…)
#   - l'export des env vars Coolify (source de vérité runtime des secrets prod)
#
# Chiffrement ASYMÉTRIQUE age : seule la clé PUBLIQUE (AGE_RECIPIENT) est sur le
# VPS. La clé privée (SOPS_AGE_KEY) reste HORS système (1Password + papier) →
# même un VPS compromis ne peut pas déchiffrer ces archives.
# Destination : R2 bucket IMMUABLE uniquement (Object Lock).
#
# Variables requises :
#   AGE_RECIPIENT                 clé publique age (age1...)
#   R2_* (ENDPOINT/keys), R2_BUCKET_IMMUTABLE
# Optionnel :
#   SECRETS_DIR (défaut /var/.secrets), COOLIFY_API_TOKEN/COOLIFY_URL/COOLIFY_APP_UUID
#   TELEGRAM_*, HEALTHCHECK_URL_SECRETS, BACKUP_REPORT_*
#
# Dépendances : age (apk add age), aws-cli, curl, tar
# Usage : bash scripts/backup-secrets.sh

set -euo pipefail

COMPONENT="secrets"
COMPONENT_LABEL="SECRETS"
BACKUP_TYPE="monthly"
source "$(dirname "$0")/backup-lib.sh"

SECRETS_DIR="${SECRETS_DIR:-/var/.secrets}"
WORK_DIR="$(mktemp -d -t axion-ia-secrets-XXXXXX)"
chmod 700 "${WORK_DIR}"
trap 'rm -rf "${WORK_DIR}"' EXIT

healthcheck_ping "/start"
require_var AGE_RECIPIENT
require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY
require_var R2_ENDPOINT
require_var R2_BUCKET_IMMUTABLE
command -v age >/dev/null 2>&1 || { record_fail "age_not_installed"; exit 1; }

START_TS=$(date +%s)
mkdir -p "${WORK_DIR}/payload"

# 1. Dossier .secrets/ (si présent)
if [ -d "${SECRETS_DIR}" ]; then
  echo "→ Collecte ${SECRETS_DIR}"
  tar -C "${SECRETS_DIR}" -cf "${WORK_DIR}/payload/dot-secrets.tar" . 2>/dev/null || true
else
  echo "⚠️ ${SECRETS_DIR} absent (rien à archiver côté .secrets)"
fi

# 2. Export des env vars Coolify (source de vérité runtime)
if [ -n "${COOLIFY_API_TOKEN:-}" ] && [ -n "${COOLIFY_URL:-}" ] && [ -n "${COOLIFY_APP_UUID:-}" ]; then
  echo "→ Export env Coolify"
  curl -fsS -m 15 -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
    "${COOLIFY_URL%/}/api/v1/applications/${COOLIFY_APP_UUID}/envs" \
    > "${WORK_DIR}/payload/coolify-envs.json" 2>/dev/null \
    || notify_telegram "Export env Coolify KO (archive .secrets seule)" "🟠"
else
  echo "⚠️ Creds Coolify absents (skip export env Coolify)"
fi

if [ -z "$(ls -A "${WORK_DIR}/payload" 2>/dev/null)" ]; then
  record_fail "nothing_to_archive"
  exit 1
fi

# 3. tar → age (chiffrement asymétrique) → R2 immuable
BACKUP_NAME="axion-ia-secrets-${DATE_TAG}-${HOSTNAME_TAG}.tar.age"
echo "→ Chiffrement age + upload R2 immuable"
tar -C "${WORK_DIR}/payload" -cf - . | age -r "${AGE_RECIPIENT}" > "${WORK_DIR}/${BACKUP_NAME}"
SIZE_BYTES=$(stat -c%s "${WORK_DIR}/${BACKUP_NAME}")
SIZE_HUMAN=$(du -h "${WORK_DIR}/${BACKUP_NAME}" | cut -f1)
REMOTE_KEY="secrets/${BACKUP_NAME}"
upload_r2 "${WORK_DIR}/${BACKUP_NAME}" "${R2_BUCKET_IMMUTABLE}" "${REMOTE_KEY}" immutable "${SECRETS_RETAIN_DAYS:-400}" \
  || { record_fail "r2_immutable_upload"; exit 1; }

DURATION=$(( $(date +%s) - START_TS ))
record_success
report_backup_run "success" "${SIZE_BYTES}" "${DURATION}" "r2-immutable" "${REMOTE_KEY}"
healthcheck_ping
notify_telegram "OK · ${SIZE_HUMAN} · ${DURATION}s (age → R2 immuable)" "🟢"
echo "✅ Backup secrets OK : ${REMOTE_KEY} (${SIZE_HUMAN})"
echo "   ⚠️ Déchiffrement : age -d -i <SOPS_AGE_KEY hors-système> ${BACKUP_NAME}"
