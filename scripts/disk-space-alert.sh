#!/usr/bin/env bash
# Alerte espace disque VPS — Hetzner CPX42 prod.
#
# Cron horaire (`crontab -e`):
#   0 * * * *  bash /opt/axion-ia/scripts/disk-space-alert.sh
#
# Comportement :
#   - Mesure % free sur / (root filesystem)
#   - Si free < SEUIL_FREE_PCT (default 20%) → alerte Telegram 🟡
#   - Si free < SEUIL_CRITIQUE_PCT (default 10%) → alerte Telegram 🔴
#   - Anti-spam : ne re-alerte que si seuil traversé OU > ALERT_INTERVAL_HOURS
#     écoulés depuis dernière alerte (default 6 h)
#
# Variables :
#   TELEGRAM_BOT_TOKEN
#   TELEGRAM_CHAT_ID
#   SEUIL_FREE_PCT             (default 20)
#   SEUIL_CRITIQUE_PCT         (default 10)
#   ALERT_INTERVAL_HOURS       (default 6)
#   STATE_FILE                 (default /var/log/disk-space-alert.state)

set -euo pipefail

SEUIL_FREE_PCT="${SEUIL_FREE_PCT:-20}"
SEUIL_CRITIQUE_PCT="${SEUIL_CRITIQUE_PCT:-10}"
ALERT_INTERVAL_HOURS="${ALERT_INTERVAL_HOURS:-6}"
STATE_FILE="${STATE_FILE:-/var/log/disk-space-alert.state}"

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

# Mesure % free sur /
FREE_PCT=$(df / --output=pcent | tail -1 | tr -d ' %' | awk '{print 100-$1}')
TOTAL_GB=$(df / -BG --output=size | tail -1 | tr -d ' G')
USED_GB=$(df / -BG --output=used | tail -1 | tr -d ' G')
AVAIL_GB=$(df / -BG --output=avail | tail -1 | tr -d ' G')

echo "Disk / : ${USED_GB} GB / ${TOTAL_GB} GB used (${FREE_PCT}% free, ${AVAIL_GB} GB avail)"

# Détermine niveau
if [ "${FREE_PCT}" -lt "${SEUIL_CRITIQUE_PCT}" ]; then
  LEVEL="CRITIQUE"
  EMOJI="🔴"
elif [ "${FREE_PCT}" -lt "${SEUIL_FREE_PCT}" ]; then
  LEVEL="WARN"
  EMOJI="🟡"
else
  LEVEL="OK"
  EMOJI="🟢"
fi

# State precedent
PREV_LEVEL="UNKNOWN"
PREV_TS=0
if [ -f "${STATE_FILE}" ]; then
  PREV_LEVEL=$(awk -F'=' '/level/{print $2}' "${STATE_FILE}" || echo "UNKNOWN")
  PREV_TS=$(awk -F'=' '/ts/{print $2}' "${STATE_FILE}" || echo 0)
fi

NOW_TS=$(date +%s)
HOURS_SINCE=$(( (NOW_TS - PREV_TS) / 3600 ))

# Anti-spam : alerte uniquement si :
#   - niveau changé
#   - OU dernière alerte > ALERT_INTERVAL_HOURS écoulée ET niveau != OK
SHOULD_ALERT=0
if [ "${LEVEL}" != "${PREV_LEVEL}" ] && [ "${LEVEL}" != "OK" ]; then
  SHOULD_ALERT=1
elif [ "${LEVEL}" != "OK" ] && [ "${HOURS_SINCE}" -ge "${ALERT_INTERVAL_HOURS}" ]; then
  SHOULD_ALERT=1
elif [ "${PREV_LEVEL}" != "OK" ] && [ "${LEVEL}" = "OK" ]; then
  # Recovery : alerte one-shot retour OK
  SHOULD_ALERT=1
fi

if [ "${SHOULD_ALERT}" = "1" ]; then
  if [ "${LEVEL}" = "OK" ] && [ "${PREV_LEVEL}" != "OK" ]; then
    notify_telegram "${EMOJI} [DISK] Recovery — espace disque normal (${FREE_PCT}% free, ${AVAIL_GB} GB avail)"
  else
    notify_telegram "${EMOJI} [DISK] ${LEVEL} — / à ${FREE_PCT}% free seulement (${USED_GB}/${TOTAL_GB} GB, ${AVAIL_GB} GB disponibles). Investigate avec \`docker system df\` puis \`docker builder prune -af\`."
  fi
fi

# Update state
mkdir -p "$(dirname "${STATE_FILE}")"
cat > "${STATE_FILE}" <<EOF
level=${LEVEL}
ts=${NOW_TS}
free_pct=${FREE_PCT}
EOF

# Code retour : 0 si OK, 1 si WARN/CRITIQUE (utilisable en exit code monitoring)
[ "${LEVEL}" = "OK" ] && exit 0 || exit 1
