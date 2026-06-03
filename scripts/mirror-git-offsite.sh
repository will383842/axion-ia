#!/usr/bin/env bash
# Mirror Git off-GitHub (ADR 0032).
#
# Protège d'un incident compte GitHub : pousse un miroir complet (toutes refs +
# tags) vers un remote indépendant. Travaille sur un clone bare DÉDIÉ — JAMAIS
# le working tree de prod (garde-fou working tree partagé multi-conversations).
#
# Variables requises :
#   REMOTE_GIT_OFFSITE   URL du remote miroir (ex. git@codeberg.org:will/axion-ia.git
#                        ou ssh sur Storage Box). Doit accepter push --mirror.
# Optionnel :
#   GIT_SOURCE_URL (défaut https://github.com/will383842/axion-ia.git)
#   MIRROR_DIR (défaut /var/backups/git-mirror.git)
#   TELEGRAM_*, HEALTHCHECK_URL_GIT_MIRROR, BACKUP_REPORT_*
#
# Usage : bash scripts/mirror-git-offsite.sh   (cron hebdo)

set -euo pipefail

COMPONENT="git_mirror"
COMPONENT_LABEL="GIT-MIRROR"
BACKUP_TYPE="weekly"
source "$(dirname "$0")/backup-lib.sh"

GIT_SOURCE_URL="${GIT_SOURCE_URL:-https://github.com/will383842/axion-ia.git}"
MIRROR_DIR="${MIRROR_DIR:-/var/backups/git-mirror.git}"

healthcheck_ping "/start"
require_var REMOTE_GIT_OFFSITE

START_TS=$(date +%s)

if [ ! -d "${MIRROR_DIR}" ]; then
  echo "→ Clone bare initial → ${MIRROR_DIR}"
  mkdir -p "$(dirname "${MIRROR_DIR}")"
  git clone --mirror "${GIT_SOURCE_URL}" "${MIRROR_DIR}" || { record_fail "clone_failed"; exit 1; }
else
  echo "→ Fetch refs"
  git --git-dir="${MIRROR_DIR}" remote update --prune origin >/dev/null 2>&1 \
    || git --git-dir="${MIRROR_DIR}" fetch --all --prune >/dev/null 2>&1 \
    || { record_fail "fetch_failed"; exit 1; }
fi

echo "→ Push --mirror → remote off-site"
git --git-dir="${MIRROR_DIR}" push --mirror "${REMOTE_GIT_OFFSITE}" >/dev/null 2>&1 \
  || { record_fail "push_mirror_failed"; exit 1; }

SIZE_BYTES=$(du -sb "${MIRROR_DIR}" | cut -f1)
SIZE_HUMAN=$(du -sh "${MIRROR_DIR}" | cut -f1)
DURATION=$(( $(date +%s) - START_TS ))
record_success
report_backup_run "success" "${SIZE_BYTES}" "${DURATION}" "offsite_git" "${MIRROR_DIR}"
healthcheck_ping
notify_telegram "OK · ${SIZE_HUMAN} · ${DURATION}s → ${REMOTE_GIT_OFFSITE}" "🟢"
echo "✅ Mirror Git OK (${SIZE_HUMAN})"
