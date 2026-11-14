#!/usr/bin/env bash
# menage-tmp.sh — Ménage SÛR de /tmp sur le VPS (axion-prod). Cron quotidien (04:40).
#
# Pour chaque dossier de premier niveau de /tmp, de plus de 7 jours ET de plus de 100 Mo,
# non utilisé par un processus ni monté dans un conteneur :
#   1. ARCHIVE d'abord, dans /root/archives-tmp/<date>-<nom>.tar.gz, tous les fichiers (hors
#      node_modules) qui n'existent dans l'historique git d'AUCUN dépôt de référence
#      (par défaut /opt/studio-axion-ia/source) ;
#   2. VÉRIFIE l'archive (gzip -t, et nombre d'entrées de `tar -tzf` = nombre de fichiers listés) ;
#   3. seulement alors, supprime le dossier.
# À la moindre anomalie (archive incomplète, doute sur un hachage, disque insuffisant, dossier
# soudain utilisé) : le dossier est LAISSÉ EN PLACE et l'anomalie est journalisée.
#
# Jamais touchés : liste blanche (pubB, rep-5f*, reconc*, iv-out, frames, alig, garder-*).
# Jamais d'autre commande destructrice que la suppression du dossier archivé et vérifié.
#
# Usage :
#   menage-tmp.sh            # cron : archive, vérifie, supprime
#   menage-tmp.sh --essai    # affiche ce qui serait fait, ne crée ni ne supprime rien
#
# Réglages (variables d'environnement ou /etc/axion-disque/menage-tmp.conf, lu s'il existe) :
#   TMP_DIR=/tmp   ARCHIVES=/root/archives-tmp   AGE_JOURS=7   TAILLE_MIN_MO=100
#   DEPOTS_REF="/opt/studio-axion-ia/source"   (plusieurs dépôts : séparés par des « : »)
#   LOG=/var/log/menage-tmp.log

set -u
export LC_ALL=C

CONF="${MENAGE_CONF:-/etc/axion-disque/menage-tmp.conf}"
[ -r "$CONF" ] && . "$CONF"

TMP_DIR="${TMP_DIR:-/tmp}"
ARCHIVES="${ARCHIVES:-/root/archives-tmp}"
AGE_JOURS="${AGE_JOURS:-7}"
TAILLE_MIN_MO="${TAILLE_MIN_MO:-100}"
DEPOTS_REF="${DEPOTS_REF:-/opt/studio-axion-ia/source}"
LOG="${LOG:-/var/log/menage-tmp.log}"
ESSAI=0
[ "${1:-}" = "--essai" ] && ESSAI=1

log() {
  local ligne
  ligne="[menage-tmp $(date +%Y-%m-%dT%H:%M:%S)] $*"
  echo "$ligne"
  [ "$ESSAI" = 0 ] && echo "$ligne" >> "$LOG" 2>/dev/null
  return 0
}

# Un seul passage à la fois.
{ exec 9>"${MENAGE_VERROU:-/var/lock/menage-tmp.lock}"; } 2>/dev/null || exec 9>/dev/null
command -v flock >/dev/null 2>&1 && ! flock -n 9 && { log "déjà en cours, abandon"; exit 0; }

[ -d "$TMP_DIR" ] || { log "$TMP_DIR introuvable"; exit 1; }
[ "$ESSAI" = 1 ] && log "MODE ESSAI : rien ne sera créé ni supprimé"

# Liste blanche : noms (de premier niveau) à ne JAMAIS toucher.
protege() {
  case "$1" in
    pubB|rep-5f*|reconc*|iv-out|frames|alig|garder-*) return 0 ;;
  esac
  return 1
}

# Dépôts de référence réellement présents.
DEPOTS=()
IFS=':' read -r -a candidats <<< "$DEPOTS_REF"
for d in "${candidats[@]}"; do
  if [ -n "$d" ] && git -C "$d" rev-parse --git-dir >/dev/null 2>&1; then DEPOTS+=("$d"); else log "dépôt de référence absent ou invalide (ignoré) : $d"; fi
done
[ "${#DEPOTS[@]}" -eq 0 ] && log "aucun dépôt de référence : TOUS les fichiers (hors node_modules) seront archivés"

# Chemins utilisés par un processus (cwd, descripteurs ouverts) ou montés dans un conteneur.
utilise() {
  local d="$1" l t
  for l in /proc/[0-9]*/cwd /proc/[0-9]*/fd/*; do
    t="$(readlink "$l" 2>/dev/null)" || continue
    case "$t" in "$d"|"$d"/*) return 0 ;; esac
  done
  if command -v lsof >/dev/null 2>&1; then
    [ -n "$(timeout 60 lsof +D "$d" 2>/dev/null | head -n 1)" ] && return 0
  fi
  if command -v docker >/dev/null 2>&1; then
    local sources s
    sources="$(docker ps -q 2>/dev/null | xargs -r docker inspect --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' 2>/dev/null)"
    while IFS= read -r s; do
      [ -z "$s" ] && continue
      case "$s" in "$d"|"$d"/*) return 0 ;; esac
    done <<< "$sources"
  fi
  return 1
}

TRAVAIL="$(mktemp -d "${TMPDIR_MENAGE:-/var/tmp}/menage-tmp.XXXXXX")" || { log "mktemp impossible"; exit 1; }
trap 'rm -rf "$TRAVAIL"' EXIT
DATE="$(date +%F)"

traiter() {
  local d="$1" nom taille_mo libre_mo
  nom="$(basename "$d")"

  if protege "$nom"; then log "PROTÉGÉ (liste blanche) : $nom"; return; fi
  if [ -L "$d" ] || mountpoint -q "$d" 2>/dev/null; then log "ignoré (lien ou point de montage) : $nom"; return; fi
  taille_mo="$(du -sxm "$d" 2>/dev/null | cut -f1)"
  [ "${taille_mo:-0}" -lt "$TAILLE_MIN_MO" ] && return
  # « Plus de N jours » : rien dans le dossier (ni lui-même) modifié depuis N jours.
  if [ -n "$(find "$d" -mtime "-$AGE_JOURS" -print -quit 2>/dev/null)" ]; then
    log "trop récent (modifié depuis moins de ${AGE_JOURS} j) : $nom (${taille_mo} Mo)"; return
  fi
  if utilise "$d"; then log "UTILISÉ par un processus ou un conteneur : $nom (${taille_mo} Mo), laissé en place"; return; fi

  # Fichiers candidats : réguliers et liens, hors node_modules.
  local liste="$TRAVAIL/liste" bizarres="$TRAVAIL/bizarres0" inconnus="$TRAVAIL/inconnus" nb_total
  find "$d" \( -type f -o -type l \) -not -path '*/node_modules/*' ! -path $'*\n*' -print > "$liste" 2>/dev/null
  find "$d" \( -type f -o -type l \) -not -path '*/node_modules/*' -path $'*\n*' -print0 > "$bizarres" 2>/dev/null
  nb_total="$(wc -l < "$liste")"

  # Parmi eux, ceux ABSENTS de l'historique git de tous les dépôts de référence.
  : > "$inconnus"
  local ok_hash=1
  if [ "${#DEPOTS[@]}" -eq 0 ] || [ ! -s "$liste" ]; then
    cp "$liste" "$inconnus"
  else
    # Les liens symboliques sont toujours archivés (non hachés).
    local reguliers="$TRAVAIL/reguliers" liens="$TRAVAIL/liens"
    : > "$reguliers"; : > "$liens"
    while IFS= read -r f; do
      if [ -L "$f" ]; then printf '%s\n' "$f" >> "$liens"; else printf '%s\n' "$f" >> "$reguliers"; fi
    done < "$liste"
    cat "$liens" > "$inconnus"
    if [ -s "$reguliers" ]; then
      local hashes="$TRAVAIL/hashes" nb_reg i=0 flags=()
      nb_reg="$(wc -l < "$reguliers")"
      if ! git hash-object --no-filters --stdin-paths < "$reguliers" > "$hashes" 2>"$TRAVAIL/hash.err" \
         || [ "$(wc -l < "$hashes")" -ne "$nb_reg" ]; then
        ok_hash=0
      else
        for depot in "${DEPOTS[@]}"; do
          i=$((i + 1))
          if ! git -C "$depot" cat-file --batch-check='%(objectname) %(objecttype)' < "$hashes" 2>/dev/null \
               | awk '{ if ($2=="missing") print 0; else print 1 }' > "$TRAVAIL/flag.$i" \
             || [ "$(wc -l < "$TRAVAIL/flag.$i")" -ne "$nb_reg" ]; then ok_hash=0; fi
          flags+=("$TRAVAIL/flag.$i")
        done
      fi
      if [ "$ok_hash" = 1 ]; then
        paste -d' ' "${flags[@]}" "$reguliers" \
          | awk -v n="${#DEPOTS[@]}" '{c=0; for(k=1;k<=n;k++) if (substr($0,2*k-1,1)=="1") c=1; if(!c) print substr($0, 2*n+1)}' >> "$inconnus"
      else
        log "doute sur les hachages pour $nom ($(head -c 150 "$TRAVAIL/hash.err" 2>/dev/null)) : TOUS les fichiers seront archivés (prudence)"
        cat "$reguliers" >> "$inconnus"
      fi
    fi
  fi
  local nb_inconnus nb_bizarres
  nb_inconnus="$(wc -l < "$inconnus")"
  nb_bizarres="$(tr -cd '\0' < "$bizarres" | wc -c)"
  local nb_a_archiver=$((nb_inconnus + nb_bizarres))

  log "candidat : $nom (${taille_mo} Mo) ; ${nb_total} fichiers (hors node_modules), ${nb_a_archiver} absents de l'historique git"

  if [ "$ESSAI" = 1 ]; then
    log "  ESSAI : archiverait ${nb_a_archiver} fichiers dans ${ARCHIVES}/${DATE}-${nom}.tar.gz puis supprimerait $d"
    return
  fi

  # Place suffisante pour l'archive (pire cas : taille du dossier) + 2 Go de marge ?
  mkdir -p "$ARCHIVES" && chmod 700 "$ARCHIVES"
  libre_mo="$(df -Pm "$ARCHIVES" | awk 'NR==2 {print $4}')"
  if [ "${libre_mo:-0}" -lt $((taille_mo + 2048)) ] && [ "$nb_a_archiver" -gt 0 ]; then
    log "ANOMALIE : place insuffisante pour archiver $nom (libre ${libre_mo} Mo) : laissé en place"; return
  fi

  if [ "$nb_a_archiver" -gt 0 ]; then
    local archive="${ARCHIVES}/${DATE}-${nom}.tar.gz" nb_dans_archive
    [ -e "$archive" ] && archive="${ARCHIVES}/${DATE}-${nom}-$(date +%H%M%S).tar.gz"
    { tr '\n' '\0' < "$inconnus"; cat "$bizarres"; } > "$TRAVAIL/a-archiver0"
    if ! tar --null --no-recursion -czf "$archive" -T "$TRAVAIL/a-archiver0" 2>"$TRAVAIL/tar.err"; then
      log "ANOMALIE : tar a échoué pour $nom ($(head -c 200 "$TRAVAIL/tar.err")) : laissé en place, archive partielle conservée : $archive"; return
    fi
    if ! gzip -t "$archive" 2>/dev/null; then log "ANOMALIE : archive corrompue $archive : $nom laissé en place"; return; fi
    nb_dans_archive="$(tar -tzf "$archive" 2>/dev/null | wc -l)"
    if [ "$nb_dans_archive" -ne "$nb_a_archiver" ]; then
      log "ANOMALIE : archive $archive contient ${nb_dans_archive} entrées au lieu de ${nb_a_archiver} : $nom laissé en place"; return
    fi
    chmod 600 "$archive"
    log "  archive vérifiée : $archive (${nb_dans_archive} fichiers)"
  else
    log "  rien à archiver (tout est dans l'historique git ou dans node_modules)"
  fi

  # Dernière garde avant suppression : le dossier n'a pas été repris entre-temps.
  if utilise "$d"; then log "ANOMALIE : $nom est devenu utilisé pendant l'archivage : laissé en place"; return; fi
  if rm -rf --one-file-system -- "$d"; then
    log "  supprimé : $d (${taille_mo} Mo libérés)"
  else
    log "ANOMALIE : suppression incomplète de $d"
  fi
}

while IFS= read -r -d '' dossier; do
  case "$dossier" in "$TMP_DIR"/*) traiter "$dossier" ;; esac
done < <(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)

log "terminé"
