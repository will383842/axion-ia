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
#   5. archive le journal (vérifié) dans /root/archives-journal, puis installe la conf journald
#      (SystemMaxUse=500M) et redémarre systemd-journald ; tout fichier écrasé est copié en .avant-<date> ;
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
for f in surveiller-disque.sh menage-tmp.sh exporter-journal.sh journald-axion.conf; do
  [ -f "$ICI/$f" ] || { dire "fichier manquant : $ICI/$f"; exit 1; }
done
bash -n "$ICI/surveiller-disque.sh" && bash -n "$ICI/menage-tmp.sh" && bash -n "$ICI/exporter-journal.sh" || { dire "erreur de syntaxe dans un script : arrêt"; exit 1; }

# Copie « .avant-<date> » de tout fichier existant avant de l'écraser (rien n'est perdu). Rangée dans
# /var/lib/axion-disque/avant/ : jamais à côté du fichier (logrotate, cron et systemd lisent leurs dossiers).
AVANT=/var/lib/axion-disque/avant
TMP_ECRITURE=/etc/axion-disque
sauver_avant() {
  local f="$1" cible
  [ -e "$f" ] || return 0
  install -d -m 700 "$AVANT" || return 1
  cible="$AVANT/$(printf '%s' "$f" | tr / _).avant-$DATE"
  # Une copie du jour existe déjà : c'est celle de l'original, ne pas l'écraser par un 2e passage.
  if [ -e "$cible" ]; then dire "copie de sécurité déjà prise : $cible"; return 0; fi
  cp -p "$f" "$cible" || return 1
  dire "copie de sécurité : $cible"
}
installer_fichier() { # installer_fichier <mode> <source> <destination>
  sauver_avant "$3" && install -D -m "$1" "$2" "$3"
}

# 1. Scripts
agir "installation de $DEST/surveiller-disque.sh" installer_fichier 755 "$ICI/surveiller-disque.sh" "$DEST/surveiller-disque.sh"
agir "installation de $DEST/menage-tmp.sh" installer_fichier 755 "$ICI/menage-tmp.sh" "$DEST/menage-tmp.sh"
agir "installation de $DEST/exporter-journal.sh" installer_fichier 755 "$ICI/exporter-journal.sh" "$DEST/exporter-journal.sh"

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
# Export compressé des 8 derniers jours du journal (recouvrement d'un jour : aucun trou, journald étant borné).
10 5 * * 0 root /opt/axion-ia/exporter-journal.sh >> /var/log/exporter-journal.log 2>&1
FIN
}
ecrire_cron() { install -d -m 700 "$TMP_ECRITURE" && sauver_avant "$CRON" && contenu_cron > "$TMP_ECRITURE/cron.tmp" && chmod 644 "$TMP_ECRITURE/cron.tmp" && mv "$TMP_ECRITURE/cron.tmp" "$CRON"; }
agir "écriture de $CRON" ecrire_cron

# 4. Rotation des journaux
contenu_logrotate() {
  cat <<'FIN'
/var/log/surveiller-disque.log /var/log/exporter-journal.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
}
# Journal du ménage de /tmp : il dit ce qui a été archivé puis supprimé, on le garde 2 ans.
/var/log/menage-tmp.log {
    weekly
    rotate 104
    compress
    missingok
    notifempty
}
FIN
}
ecrire_logrotate() { install -d -m 700 "$TMP_ECRITURE" && sauver_avant "$LOGROTATE" && contenu_logrotate > "$TMP_ECRITURE/logrotate.tmp" && chmod 644 "$TMP_ECRITURE/logrotate.tmp" && mv "$TMP_ECRITURE/logrotate.tmp" "$LOGROTATE"; }
agir "écriture de $LOGROTATE" ecrire_logrotate

# 5. journald
archiver_journal() {
  # Archive le journal AVANT toute limite. Vérifié (gzip -t, liste non vide, tar -d) ; au moindre
  # défaut, message clair et RIEN n'est appliqué. Jamais en silence.
  local a="/root/archives-journal/journal-$DATE.tar.gz" rc
  [ -d /var/log/journal ] || { dire "journald : pas de /var/log/journal (journal en mémoire), rien à archiver"; return 0; }
  install -d -m 700 /root/archives-journal || return 1
  # Ferme le fichier actif (il devient un fichier archivé, qui ne bouge plus) avant la copie.
  journalctl --flush --rotate || { dire "journald : journalctl --flush --rotate en échec, limite NON appliquée"; return 1; }
  # Seuls les fichiers ACTIFS (system.journal, user-*.journal) sont exclus : journald n'en supprime jamais
  # un actif, donc rien n'est perdu ; les fichiers archivés (rotés) sont tous copiés et ne bougent plus.
  local mid
  mid="$(cat /etc/machine-id)" || { dire "journald : /etc/machine-id illisible, limite NON appliquée"; return 1; }
  tar -C /var/log --exclude="journal/$mid/system.journal" --exclude="journal/$mid/user-*.journal" -czf "$a" journal; rc=$?
  if [ "$rc" -eq 1 ]; then
    dire "journald : ÉCHEC PROPRE : « file changed as we read it » (un fichier du journal a changé pendant la copie). Rien n'est appliqué ; relancer l'installeur. Archive conservée : $a.partiel"
    mv -f "$a" "$a.partiel" 2>/dev/null; return 1
  elif [ "$rc" -ne 0 ]; then
    dire "journald : tar a échoué (code $rc), limite NON appliquée (archive : $a.partiel)"; mv -f "$a" "$a.partiel" 2>/dev/null; return 1
  fi
  if ! gzip -t "$a" || [ "$(tar -tzf "$a" | wc -l)" -le 0 ] || ! tar -dzf "$a" -C /var/log >/dev/null 2>&1; then
    dire "journald : archive invalide ou différente du journal (gzip -t / liste / tar -d), limite NON appliquée (archive : $a.partiel)"
    mv -f "$a" "$a.partiel" 2>/dev/null; return 1
  fi
  chmod 600 "$a"; dire "journald : journal archivé et vérifié : $a"
}
installer_journald() {
  install -d -m 755 /etc/systemd/journald.conf.d || return 1
  if ! cmp -s "$ICI/journald-axion.conf" "$JOURNALD_DEST"; then
    archiver_journal || return 1
    sauver_avant "$JOURNALD_DEST" || return 1
    install -m 644 "$ICI/journald-axion.conf" "$JOURNALD_DEST" || return 1
    systemctl restart systemd-journald || { dire "journald : redémarrage en échec"; return 1; }
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
