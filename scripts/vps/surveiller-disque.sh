#!/usr/bin/env bash
# surveiller-disque.sh — Surveillance du disque du VPS (axion-prod). Cron hôte, toutes les 10 min.
#
# NE FAIT JAMAIS RIEN D'AUTRE QUE MESURER ET PRÉVENIR : aucune suppression, aucun
# nettoyage, aucune commande Docker autre que des lectures (ps, images, system df).
#
# - Mesure `df /` ; écrit une ligne par heure dans /var/lib/axion-disque/historique.csv
#   (horodatage ISO, % utilisé, Go libres).
# - Seuils : 75 % info (1×/jour) · 85 % alerte (1×/6 h) · 90 % critique (1×/30 min).
#   Anti-répétition par fichiers d'état dans /var/lib/axion-disque/.
# - Message en français : niveau, top 5 des causes, « plein dans N jours », pic des 7 jours.
# - Envoi Telegram (API du bot, salon « 🔧 Axion-IA — Technique »). Jeton et chat_id lus dans
#   /etc/axion-disque/telegram.env (root, 0600). RIEN de secret dans le dépôt.
#
# Usage :
#   surveiller-disque.sh            # cron : mesure, historise, prévient si seuil franchi
#   surveiller-disque.sh --essai    # affiche le message complet SANS envoyer, sans rien écrire
#
# Variables de test (facultatives) : DISQUE_DIR (état), DISQUE_ENV (fichier Telegram),
# DISQUE_SIMULE_POURCENT (force le % mesuré, en mode --essai seulement).

set -u
export LC_ALL=C

DISQUE_DIR="${DISQUE_DIR:-/var/lib/axion-disque}"
DISQUE_ENV="${DISQUE_ENV:-/etc/axion-disque/telegram.env}"
HISTORIQUE="${DISQUE_DIR}/historique.csv"
HISTORIQUE_MAX_LIGNES=2500   # ~100 jours à 1 ligne/heure
ESSAI=0
[ "${1:-}" = "--essai" ] && ESSAI=1

log() { echo "[surveiller-disque $(date +%Y-%m-%dT%H:%M:%S)] $*" >&2; }

# ─── 1. Mesure ───────────────────────────────────────────────────────────────
LIGNE_DF="$(df -P -k / | awk 'NR==2 {print $5, $4}')"
POURCENT="${LIGNE_DF%% *}"; POURCENT="${POURCENT%\%}"
LIBRE_KO="${LIGNE_DF##* }"
if [ "$ESSAI" = 1 ] && [ -n "${DISQUE_SIMULE_POURCENT:-}" ]; then POURCENT="$DISQUE_SIMULE_POURCENT"; fi
case "$POURCENT$LIBRE_KO" in ''|*[!0-9]*) log "mesure df illisible : '$LIGNE_DF'"; exit 1 ;; esac
LIBRE_GO="$(awk -v k="$LIBRE_KO" 'BEGIN{printf "%.1f", k/1048576}')"
MAINTENANT="$(date +%s)"
HORO="$(date +%Y-%m-%dT%H:%M:%S)"
HEURE="$(date +%Y-%m-%dT%H)"

fr() { sed 's/\([0-9]\)\.\([0-9]\)/\1,\2/g'; }   # décimale française (entre deux chiffres seulement)

# ─── 2. Historique horaire ───────────────────────────────────────────────────
if [ "$ESSAI" = 0 ]; then
  mkdir -p "$DISQUE_DIR" || { log "impossible de créer $DISQUE_DIR"; exit 1; }
  derniere="$(tail -n 1 "$HISTORIQUE" 2>/dev/null | cut -c1-13)"
  if [ "$derniere" != "$HEURE" ]; then
    echo "${HORO},${POURCENT},${LIBRE_GO}" >> "$HISTORIQUE"
    if [ "$(wc -l < "$HISTORIQUE")" -gt "$HISTORIQUE_MAX_LIGNES" ]; then
      tail -n "$HISTORIQUE_MAX_LIGNES" "$HISTORIQUE" > "${HISTORIQUE}.tmp" && mv "${HISTORIQUE}.tmp" "$HISTORIQUE"
    fi
  fi
fi

# ─── 3. Niveau et anti-répétition ────────────────────────────────────────────
if   [ "$POURCENT" -ge 90 ]; then NIVEAU=critique; INTERVALLE=1800;  ICONE="🔴"; LIBELLE="CRITIQUE"
elif [ "$POURCENT" -ge 85 ]; then NIVEAU=alerte;   INTERVALLE=21600; ICONE="🟠"; LIBELLE="ALERTE"
elif [ "$POURCENT" -ge 75 ]; then NIVEAU=info;     INTERVALLE=86400; ICONE="🟡"; LIBELLE="information"
else NIVEAU=ok; INTERVALLE=0; ICONE="🟢"; LIBELLE="normal"
fi
if [ "$ESSAI" = 0 ]; then
  [ "$NIVEAU" = ok ] && exit 0
  FICHIER_ETAT="${DISQUE_DIR}/dernier-envoi-${NIVEAU}"
  dernier="$(cat "$FICHIER_ETAT" 2>/dev/null || echo 0)"
  case "$dernier" in ''|*[!0-9]*) dernier=0 ;; esac
  [ $((MAINTENANT - dernier)) -lt "$INTERVALLE" ] && exit 0
fi

# ─── 4. Pente (« plein dans N jours ») et pic des 7 jours ───────────────────
PREVISION="Prévision : pas assez d'historique (il faut quelques jours de mesures)."
PIC="Pic des 7 derniers jours : pas encore d'historique."
if [ -s "$HISTORIQUE" ]; then
  coupe14="$(date -d '14 days ago' +%F)"
  coupe7="$(date -d '7 days ago' +%F)"
  # Minimum quotidien des Go libres sur 14 jours, converti en numéro de jour.
  minimums="$(awk -F, -v c="$coupe14" '{j=substr($1,1,10); if (j>=c) {if(!(j in m)||$3<m[j]) m[j]=$3}} END{for(j in m) print j, m[j]}' "$HISTORIQUE" | sort)"
  fichier_pts="$(mktemp)"
  while read -r jour libre; do
    [ -n "$jour" ] && echo "$(( $(date -d "$jour" +%s) / 86400 )) $libre" >> "$fichier_pts"
  done <<EOF
$minimums
EOF
  nb_pts="$(wc -l < "$fichier_pts")"
  if [ "$nb_pts" -ge 3 ]; then
    PREVISION="$(awk -v libre="$LIBRE_GO" '
      {x[NR]=$1; y[NR]=$2; n=NR}
      END{
        for(i=1;i<=n;i++){sx+=x[i]; sy+=y[i]; sxy+=x[i]*y[i]; sxx+=x[i]*x[i]}
        d=n*sxx-sx*sx
        if(d==0){print "Prévision : stable."; exit}
        pente=(n*sxy-sx*sy)/d          # Go libres par jour (négatif = le disque se remplit)
        conso=-pente
        if(conso<=0.01){print "Prévision : stable (les minimums quotidiens ne baissent pas sur " n " jours)."; exit}
        printf "Prévision : plein dans %.0f jours au rythme des minimums quotidiens (%.1f Go/jour sur %d jours).\n", libre/conso, conso, n
      }' "$fichier_pts" | fr)"
  fi
  rm -f "$fichier_pts"
  pic="$(awk -F, -v c="$coupe7" '{if (substr($1,1,10)>=c && $2+0>max) {max=$2+0; quand=$1}} END{if(max>0) print max, quand}' "$HISTORIQUE")"
  [ -n "$pic" ] && PIC="Pic des 7 derniers jours : ${pic%% *} % (le ${pic#* })."
fi

# ─── 5. Top 5 des causes (lectures bornées, priorité minimale) ───────────────
BORNE="nice -n 19"
command -v ionice >/dev/null 2>&1 && BORNE="ionice -c3 nice -n 19"

# convertit « 858MB », « 4.2GB », « 12kB » en Mo (sortie : entier)
vers_mo() { awk '{v=$1; u=v; gsub(/[0-9.]/,"",u); sub(/[^0-9.].*/,"",v);
  f=1; if(u=="kB"||u=="KB") f=1/1000; else if(u=="MB") f=1; else if(u=="GB") f=1000; else if(u=="TB") f=1000000; else if(u=="B") f=1/1000000;
  printf "%d", v*f}'; }
formate_go() { awk -v m="$1" 'BEGIN{printf "%.1f", m/1000}' | fr; }

causes="$(mktemp)"
if command -v docker >/dev/null 2>&1; then
  # Couche écrite de chaque conteneur (partie « Size » avant « (virtual »).
  $BORNE timeout 90 docker ps -s --format '{{.Names}}|{{.Size}}' 2>/dev/null | while IFS='|' read -r nom taille; do
    mo="$(echo "${taille%% *}" | vers_mo)"
    [ "${mo:-0}" -gt 0 ] && echo "${mo}|couche écrite du conteneur ${nom}" >> "$causes"
  done
  # docker system df : images, cache de build, volumes (LECTURE SEULE).
  $BORNE timeout 120 docker system df --format '{{.Type}}|{{.Size}}|{{.Reclaimable}}' 2>/dev/null | while IFS='|' read -r type taille recup; do
    mo="$(echo "$taille" | vers_mo)"
    [ "${mo:-0}" -gt 0 ] && echo "${mo}|Docker, ${type} (récupérable selon Docker : ${recup})" >> "$causes"
  done
  nb_images_site="$(docker images --format '{{.Repository}}' 2>/dev/null | grep -c 'axion-ia$' || true)"
fi
for chemin in /tmp /root/archives-tmp /root/travaux-claude /opt/studio-axion-ia /opt/sauvegardes-studio /var/log; do
  [ -d "$chemin" ] || continue
  mo="$($BORNE timeout 90 du -sxm "$chemin" 2>/dev/null | cut -f1)"
  [ "${mo:-0}" -gt 0 ] && echo "${mo}|${chemin}" >> "$causes"
done
TOP5="$(sort -t'|' -k1,1 -rn "$causes" | head -5 | awk -F'|' '{printf "%d. %s Go — %s\n", NR, sprintf("%.1f", $1/1000), $2}' | fr)"
rm -f "$causes"
[ -z "$TOP5" ] && TOP5="(mesure des causes indisponible)"

INFOS=""
[ -n "${nb_images_site:-}" ] && INFOS="Images du site présentes sur le serveur : ${nb_images_site} (2 ou 3 en même temps pendant une mise en ligne, c'est normal)."

# ─── 6. Message ──────────────────────────────────────────────────────────────
LIBRE_FR="$(echo "$LIBRE_GO" | fr)"
MESSAGE="$(cat <<EOF
${ICONE} Disque axion-prod : ${POURCENT} % utilisé, ${LIBRE_FR} Go libres — niveau ${LIBELLE}
${PREVISION}
${PIC}

Les cinq premières causes mesurées :
${TOP5}
${INFOS}

Ce message ne fait que prévenir : rien n'a été supprimé. Marche à suivre : docs/runbooks/R20-disk-saturation.md (ménage de /tmp : /opt/axion-ia/menage-tmp.sh --essai).
EOF
)"

if [ "$ESSAI" = 1 ]; then
  echo "=== MODE ESSAI : rien n'est envoyé, rien n'est écrit ==="
  echo "$MESSAGE"
  exit 0
fi

# ─── 7. Envoi Telegram ───────────────────────────────────────────────────────
if [ ! -f "$DISQUE_ENV" ]; then log "fichier $DISQUE_ENV absent : message non envoyé ($NIVEAU ${POURCENT} %)"; exit 1; fi
perms="$(stat -c '%a' "$DISQUE_ENV" 2>/dev/null)"
if [ "$perms" != "600" ] && [ "$perms" != "400" ]; then
  log "$DISQUE_ENV doit être en 0600 (actuel : $perms) : message non envoyé"; exit 1
fi
lire_var() { sed -n "s/^$1=//p" "$DISQUE_ENV" | tail -n 1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//"; }
JETON="$(lire_var TELEGRAM_BOT_TOKEN)"
CHAT="$(lire_var TELEGRAM_CHAT_ID)"
FIL="$(lire_var TELEGRAM_MESSAGE_THREAD_ID)"   # facultatif (sujet d'un groupe à sujets)
if [ -z "$JETON" ] || [ -z "$CHAT" ]; then log "TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID vide dans $DISQUE_ENV"; exit 1; fi

# Le jeton passe par la configuration lue sur l'entrée standard : il n'apparaît pas dans `ps`.
args=(--silent --show-error --fail --max-time 20 --config - --data-urlencode "chat_id=${CHAT}" --data-urlencode "text=${MESSAGE}")
[ -n "$FIL" ] && args+=(--data-urlencode "message_thread_id=${FIL}")
if printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$JETON" | curl "${args[@]}" >/dev/null; then
  echo "$MAINTENANT" > "$FICHIER_ETAT"
  log "message ${NIVEAU} envoyé (${POURCENT} %)"
else
  log "ÉCHEC d'envoi Telegram (${NIVEAU}, ${POURCENT} %) : nouvel essai au prochain passage"
  exit 1
fi
