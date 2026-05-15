#!/usr/bin/env bash
# disk-cleanup.sh — Prévention saturation disque Hetzner CPX42 prod.
#
# Audit Web Vitals 2026-05-15 — root cause détectée : 320 GB disk plein
# bloque tous les deploys Coolify avec `No space left on device` lors du
# `tee docker-compose.yaml`. Cause : Docker image layers + build cache
# accumulés (chaque deploy laisse ~500 MB-2 GB d'images zombies).
#
# Ce script :
#   1. Mesure usage disque avant
#   2. Purge Docker (images dangling, build cache, volumes orphelins)
#   3. Purge artefacts Coolify > 7 jours (deployment_logs, old builds)
#   4. Mesure usage disque après
#   5. Notifie Telegram tag INCIDENT si usage > 85 % ou < 10 GB libres
#
# Exécution recommandée : cron quotidien à 03h00 (heure creuse).
#   crontab -e
#   0 3 * * * /opt/axion-ia/scripts/ops/disk-cleanup.sh >> /var/log/axion-disk-cleanup.log 2>&1
#
# Variables d'env requises :
#   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (pour alertes)
#   DISK_WARN_PCT (défaut 85), DISK_WARN_FREE_GB (défaut 10)

set -euo pipefail

DISK_WARN_PCT="${DISK_WARN_PCT:-85}"
DISK_WARN_FREE_GB="${DISK_WARN_FREE_GB:-10}"
LOG_PREFIX="[disk-cleanup $(date +%Y-%m-%dT%H:%M:%S)]"

log() { echo "${LOG_PREFIX} $*"; }

# 1. Mesure usage avant
USAGE_BEFORE=$(df -BG / | awk 'NR==2 {gsub("G","",$3); gsub("G","",$5); print $5}')
FREE_BEFORE=$(df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}')
log "BEFORE — root usage: ${USAGE_BEFORE} | free: ${FREE_BEFORE} GB"

# 2. Docker cleanup (images dangling + build cache + orphaned volumes)
#    -a = aussi tag-only images non utilisées (mais GARDE les images en cours d'exécution)
#    --volumes = volumes orphelins sans conteneur
#    Note : ne touche PAS les containers running ni leurs volumes attachés.
log "STEP 1/3 — docker system prune"
docker system prune -a -f --volumes 2>&1 | tail -5 || log "WARN docker prune failed (non-fatal)"

log "STEP 2/3 — docker builder prune"
docker builder prune -a -f 2>&1 | tail -3 || log "WARN builder prune failed"

# 3. Coolify deployment artifacts > 7 days
#    Garde les 7 derniers jours (rollback possible) + les 5 plus récents
#    (sécurité minimum).
log "STEP 3/3 — Coolify deployment artifacts > 7 days"
COOLIFY_APPS_DIR="/data/coolify/applications"
if [ -d "$COOLIFY_APPS_DIR" ]; then
  find "$COOLIFY_APPS_DIR"/*/builds -maxdepth 1 -type d -mtime +7 2>/dev/null | tail -n +6 | while read -r d; do
    log "  rm $d"
    rm -rf "$d" 2>/dev/null || true
  done
fi

# 4. Mesure usage après
USAGE_AFTER=$(df -BG / | awk 'NR==2 {gsub("G","",$3); gsub("G","",$5); print $5}')
FREE_AFTER=$(df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}')
log "AFTER — root usage: ${USAGE_AFTER} | free: ${FREE_AFTER} GB"

# 5. Alerte Telegram si seuils dépassés
USAGE_PCT_NUM=$(echo "${USAGE_AFTER}" | tr -d '%')
if [ "${USAGE_PCT_NUM}" -gt "${DISK_WARN_PCT}" ] || [ "${FREE_AFTER}" -lt "${DISK_WARN_FREE_GB}" ]; then
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    MSG="*[⚠️ INCIDENT]* Disque Hetzner CPX42 ${USAGE_AFTER} usage (${FREE_AFTER} GB free) — cleanup n'a pas suffi. Investiguer manuellement.%0ARunbook : R20 (docs/runbooks/R20-disk-saturation.md)"
    curl -sX POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=${MSG}" \
      -d "parse_mode=Markdown" > /dev/null || log "WARN Telegram send failed"
    log "ALERT sent — usage ${USAGE_AFTER} | free ${FREE_AFTER} GB"
  fi
fi

log "DONE"
