#!/usr/bin/env bash
# installer-garde-fous-disque.sh — Installe (idempotent) les garde-fous disque sur le VPS.
# À lancer EN ROOT sur axion-prod, depuis une copie à jour du dépôt (jamais depuis le CI).
#
#   installer-garde-fous-disque.sh --essai   # affiche ce qui serait fait, ne change rien
#   installer-garde-fous-disque.sh           # installe
#
# Ce que fait l'installation :
#   1. copie surveiller-disque.sh et menage-tmp.sh dans /opt/axion-ia/ (0755) ;
#   2. crée /var/lib/axion-disque/ et /etc/axion-disque/ (0700) — SANS écrire de secret ;
#   3. écrit /etc/cron.d/axion-disque : surveillance toutes les 10 min, ménage de /tmp à 04:40 ;
#   4. écrit /etc/logrotate.d/axion-disque ;
#   5. installe la conf journald (SystemMaxUse=500M) et redémarre systemd-journald ;
#   6. RETIRE du crontab root la ligne cassée « disk-alert » (sauvegarde d'abord le crontab
#      dans /root/crontab.avant-garde-fous-<date>).
# Elle ne supprime aucun autre élément, ne touche pas à Docker, aux volumes ni aux sauvegardes.
#
# Création du fichier Telegram (à faire À LA MAIN, une fois, le secret ne va jamais dans le dépôt) :
#   install -d -m 700 /etc/axion-disque
#   umask 077
#   cat > /etc/axion-disque/telegram.env <<'FIN'
#   TELEGRAM_BOT_TOKEN=<jeton du bot>
#   TELEGRAM_CHAT_ID=<identifiant du salon « 🔧 Axion-IA — Technique »>
#   # TELEGRAM_MESSAGE_THREAD_ID=<si le salon est un sujet d'un groupe>
#   FIN
#   chmod 600 /etc/axion-disque/telegram.env
# Puis tester sans envoyer : /opt/axion-ia/surveiller-disque.sh --essai

set -u
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ESSAI=0
[ "${1:-}" = "--essai" ] && ESSAI=1

DEST=/opt/axion-ia
CRON=/etc/cron.d/axion-disque
LOGROTATE=/etc/logrotate.d/axion-disque
JOURNALD_DEST=/etc/systemd/journald.conf.d/axion.conf
DATE="$(date +%F-%H%M%S)"

dire() { echo "[installer-garde-fous] $*"; }
agir() { # agir <description> <commande...>
  local desc="$1"; shift
  if [ "$ESSAI" = 1 ]; then dire "ESSAI : $desc"; else dire "$desc"; "$@" || { dire "ÉCHEC : $desc"; exit 1; }; fi
}

if [ "$ESSAI" = 0 ] && [ "$(id -u)" -ne 0 ]; then dire "à lancer en root (ou avec --essai)"; exit 1; fi
for f in surveiller-disque.sh menage-tmp.sh journald-axion.conf; do
  [ -f "$ICI/$f" ] || { dire "fichier manquant : $ICI/$f"; exit 1; }
done
bash -n "$ICI/surveiller-disque.sh" && bash -n "$ICI/menage-tmp.sh" || { dire "erreur de syntaxe dans un script : arrêt"; exit 1; }

# 1. Scripts
agir "installation de $DEST/surveiller-disque.sh" install -D -m 755 "$ICI/surveiller-disque.sh" "$DEST/surveiller-disque.sh"
agir "installation de $DEST/menage-tmp.sh" install -D -m 755 "$ICI/menage-tmp.sh" "$DEST/menage-tmp.sh"

# 2. Dossiers
agir "dossier /var/lib/axion-disque (historique et états)" install -d -m 755 /var/lib/axion-disque
agir "dossier /etc/axion-disque (0700)" install -d -m 700 /etc/axion-disque
if [ ! -f /etc/axion-disque/telegram.env ]; then
  dire "ATTENTION : /etc/axion-disque/telegram.env n'existe pas : les alertes ne partiront pas tant qu'il n'est pas créé (voir l'en-tête de ce script)."
fi

# 3. Cron
contenu_cron() {
  cat <<'FIN'
# Garde-fous disque (installé par scripts/vps/installer-garde-fous-disque.sh). Ne fait que mesurer, prévenir et archiver puis ranger /tmp.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/10 * * * * root /opt/axion-ia/surveiller-disque.sh >> /var/log/surveiller-disque.log 2>&1
40 4 * * * root /opt/axion-ia/menage-tmp.sh > /dev/null 2>> /var/log/menage-tmp.log
FIN
}
ecrire_cron() { contenu_cron > "$CRON.tmp" && chmod 644 "$CRON.tmp" && mv "$CRON.tmp" "$CRON"; }
agir "écriture de $CRON" ecrire_cron

# 4. Rotation des journaux
contenu_logrotate() {
  cat <<'FIN'
/var/log/surveiller-disque.log /var/log/menage-tmp.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
}
FIN
}
ecrire_logrotate() { contenu_logrotate > "$LOGROTATE"; chmod 644 "$LOGROTATE"; }
agir "écriture de $LOGROTATE" ecrire_logrotate

# 5. journald
installer_journald() {
  install -d -m 755 /etc/systemd/journald.conf.d
  if ! cmp -s "$ICI/journald-axion.conf" "$JOURNALD_DEST"; then
    install -m 644 "$ICI/journald-axion.conf" "$JOURNALD_DEST"
    systemctl restart systemd-journald
    dire "journald : limite 500M appliquée (redémarré)"
  else
    dire "journald : déjà à jour"
  fi
}
agir "conf journald $JOURNALD_DEST" installer_journald

# 6. Ligne cassée « disk-alert » du crontab root
retirer_disk_alert() {
  local actuel="$1"
  if ! crontab -l > "$actuel" 2>/dev/null; then dire "pas de crontab root : rien à retirer"; return 0; fi
  if ! grep -q 'disk-alert' "$actuel"; then dire "ligne disk-alert déjà absente du crontab root"; return 0; fi
  local sauvegarde="/root/crontab.avant-garde-fous-${DATE}"
  cp -p "$actuel" "$sauvegarde" && dire "crontab root sauvegardé : $sauvegarde" || return 1
  # On retire la ligne cassée et son commentaire d'introduction, rien d'autre.
  grep -v -e 'disk-alert' -e '^# Alerte disque si > 80%' "$actuel" > "$actuel.nouveau"
  crontab "$actuel.nouveau" && dire "ligne disk-alert retirée du crontab root"
}
if [ "$ESSAI" = 1 ]; then
  dire "ESSAI : sauvegarde du crontab root dans /root/crontab.avant-garde-fous-${DATE} puis retrait de la ligne « disk-alert » (et de son commentaire) si elle existe"
else
  tmp="$(mktemp)"; retirer_disk_alert "$tmp" || { dire "ÉCHEC du retrait de disk-alert (le crontab n'a pas été modifié sans sauvegarde)"; rm -f "$tmp" "$tmp.nouveau"; exit 1; }
  rm -f "$tmp" "$tmp.nouveau"
fi

dire "terminé. Vérifier : /opt/axion-ia/surveiller-disque.sh --essai  ·  /opt/axion-ia/menage-tmp.sh --essai"
