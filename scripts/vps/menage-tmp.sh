#!/usr/bin/env bash
# menage-tmp.sh — Ménage SÛR de /tmp sur le VPS (axion-prod). Cron quotidien (04:40).
#
# Pour chaque dossier de premier niveau de /tmp, de plus de 7 jours ET de plus de 100 Mo,
# non utilisé par un processus ni monté dans un conteneur (même arrêté) :
#   1. écrit un MANIFESTE de TOUT le dossier (type, empreinte git, mode, taille, date, chemin
#      relatif), conservé à côté de l'archive : <archive>.MANIFESTE.tsv ;
#   2. ARCHIVE dans /root/archives-tmp/<date>-<nom>.tar.gz le manifeste + tous les fichiers
#      (node_modules compris) dont l'empreinte n'est PAS dans les objets ATTEIGNABLES depuis la
#      branche principale (origin/HEAD, sinon origin/master ou origin/main) d'un dépôt de
#      référence (par défaut /opt/studio-axion-ia/source) ; ensemble calculé une fois par passage
#      avec `git rev-list --objects` (un objet présent mais non relié peut être effacé par gc) ;
#   3. VÉRIFIE l'archive : gzip -t, nombre d'entrées, manifeste présent, et `tar -dzf` (le contenu
#      de l'archive est comparé aux fichiers réels) ;
#   4. seulement alors, et après un second test d'âge et d'usage, supprime le dossier.
# Dans le doute on GARDE : délai dépassé de lsof, lsof absent, échec de docker, de find ou de du
# = dossier « utilisé » ou « récent », laissé en place et journalisé.
# Archive en échec : renommée .partiel, dossier gardé.
#
# Jamais touchés : liste blanche (pubB, rep-5f*, reconc*, iv-out, frames, alig, garder-*,
# systemd-private-*, snap-private-tmp, .X11-unix, .ICE-unix, b-test).
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
set -o pipefail
export LC_ALL=C

CONF="${MENAGE_CONF:-/etc/axion-disque/menage-tmp.conf}"
[ -r "$CONF" ] && . "$CONF"

TMP_DIR="${TMP_DIR:-/tmp}"
ARCHIVES="${ARCHIVES:-/root/archives-tmp}"
AGE_JOURS="${AGE_JOURS:-7}"
TAILLE_MIN_MO="${TAILLE_MIN_MO:-100}"
DEPOTS_REF="${DEPOTS_REF:-/opt/studio-axion-ia/source}"
LOG="${LOG:-/var/log/menage-tmp.log}"
# Garde-fous de configuration : seul /tmp ou /var/tmp peut être rangé ; les archives ne vont jamais dedans.
case "$TMP_DIR" in
  /tmp|/var/tmp) ;;
  *) echo "[menage-tmp] REFUS : TMP_DIR=$TMP_DIR n'est ni /tmp ni /var/tmp" >&2; exit 1 ;;
esac
case "$ARCHIVES/" in
  "$TMP_DIR"/*) echo "[menage-tmp] REFUS : ARCHIVES=$ARCHIVES est sous $TMP_DIR (les archives seraient rangées avec le reste)" >&2; exit 1 ;;
esac
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

# Liste blanche : noms (de premier niveau, relatifs à $TMP_DIR) à ne JAMAIS toucher.
protege() {
  case "$1" in
    pubB|rep-5f*|reconc*|iv-out|frames|alig|garder-*) return 0 ;;
    systemd-private-*|snap-private-tmp|.X11-unix|.ICE-unix|b-test) return 0 ;;
    .menage-supp-*) return 0 ;; # dossier mis de côté par ce script (reste d'une interruption) : jamais retraité
  esac
  return 1
}

TRAVAIL="$(mktemp -d "${TMPDIR_MENAGE:-/var/tmp}/menage-tmp.XXXXXX")" || { log "mktemp impossible"; exit 1; }
trap 'rm -rf "$TRAVAIL"' EXIT
DATE="$(date +%F)"

# Ensemble « connu » : objets ATTEIGNABLES depuis la branche principale de chaque dépôt de
# référence, calculé UNE fois par passage (liste triée d'empreintes).
CONNUS="$TRAVAIL/connus"
: > "$CONNUS"
NB_DEPOTS=0
IFS=':' read -r -a candidats <<< "$DEPOTS_REF"
for d in "${candidats[@]}"; do
  [ -n "$d" ] || continue
  if ! git -C "$d" rev-parse --git-dir >/dev/null 2>&1; then log "dépôt de référence absent ou invalide (ignoré) : $d"; continue; fi
  ref=""
  for r in origin/HEAD origin/master origin/main; do
    if git -C "$d" rev-parse --verify --quiet "$r^{commit}" >/dev/null 2>&1; then ref="$r"; break; fi
  done
  if [ -z "$ref" ]; then log "dépôt $d : ni origin/HEAD, ni origin/master, ni origin/main (ignoré)"; continue; fi
  # Dépôt superficiel ou « promisor » : des objets atteignables peuvent manquer, ce n'est pas une référence fiable.
  if [ "$(git -C "$d" rev-parse --is-shallow-repository 2>/dev/null)" = "true" ] || [ "$(git -C "$d" config --get remote.origin.promisor 2>/dev/null)" = "true" ]; then
    log "dépôt $d : superficiel ou partiel (promisor) : ignoré, ses fichiers seront archivés"; continue
  fi
  # rev-list écrit dans un fichier temporaire, ajouté à l'ensemble seulement si tout a réussi.
  if git -C "$d" rev-list --objects "$ref" 2>"$TRAVAIL/revlist.err" | awk '{print $1}' > "$TRAVAIL/revlist.tmp"; then
    cat "$TRAVAIL/revlist.tmp" >> "$CONNUS" && { NB_DEPOTS=$((NB_DEPOTS + 1)); log "dépôt de référence : $d ($ref)"; }
  else
    log "dépôt $d : rev-list en échec ($(head -c 150 "$TRAVAIL/revlist.err" 2>/dev/null)) : ignoré, ses fichiers seront archivés"
  fi
done
sort -u -o "$CONNUS" "$CONNUS"
[ "$NB_DEPOTS" -eq 0 ] && log "aucun dépôt de référence exploitable : TOUS les fichiers seront archivés"

# Vrai (0) si le dossier est « récent » : un fichier modifié (mtime) OU changé (ctime) depuis N
# jours. Une erreur de find compte comme « récent » (dans le doute, on garde).
recent() {
  # Le dossier racine lui-même n'est jugé que sur mtime : son ctime change quand on le RENOMME
  # (mise de côté avant suppression), ce qui n'est pas une activité du contenu.
  local sortie
  sortie="$(find "$1" -mindepth 1 \( -mtime "-$AGE_JOURS" -o -ctime "-$AGE_JOURS" \) -print -quit 2>"$TRAVAIL/find.err")" || return 0
  [ -n "$sortie" ] && return 0
  sortie="$(find "$1" -maxdepth 0 -mtime "-$AGE_JOURS" -print -quit 2>"$TRAVAIL/find.err")" || return 0
  [ -n "$sortie" ]
}

# Vrai (0) si le dossier est utilisé par un processus ou monté dans un conteneur (arrêté compris).
# Tout échec d'un contrôle (lsof absent ou en délai, docker en échec) compte comme « utilisé ».
RAISON_USAGE=""
utilise() {
  local d="$1" l t rc sortie
  RAISON_USAGE=""
  for l in /proc/[0-9]*/cwd /proc/[0-9]*/fd/*; do
    t="$(readlink "$l" 2>/dev/null)" || continue
    case "$t" in "$d"|"$d"/*) RAISON_USAGE="processus ($l)"; return 0 ;; esac
  done
  if grep -qsF -- "$d/" /proc/[0-9]*/maps 2>/dev/null; then RAISON_USAGE="fichier projeté en mémoire"; return 0; fi
  # Montage à l'intérieur du dossier (point de montage = colonne 5 de mountinfo).
  if [ -r /proc/self/mountinfo ] && awk -v p="$d/" '{ gsub(/\\040/, " ", $5); if (index($5,p)==1) print }' /proc/self/mountinfo | grep -q .; then
    RAISON_USAGE="point de montage à l'intérieur"; return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    sortie="$(timeout 60 lsof +D "$d" 2>/dev/null | head -n 1; exit "${PIPESTATUS[0]}")"; rc=$?
    if [ "$rc" -eq 124 ]; then RAISON_USAGE="lsof : délai dépassé"; return 0; fi
    if [ -n "$sortie" ]; then RAISON_USAGE="lsof : fichier ouvert"; return 0; fi
    if [ "$rc" -gt 1 ]; then RAISON_USAGE="lsof en échec (code $rc)"; return 0; fi
  else
    RAISON_USAGE="lsof absent (contrôle impossible)"; return 0
  fi
  if command -v docker >/dev/null 2>&1; then
    local ids sources s
    if ! ids="$(timeout 60 docker ps -aq 2>/dev/null)"; then RAISON_USAGE="docker ps en échec"; return 0; fi
    if [ -n "$ids" ]; then
      # shellcheck disable=SC2086
      if ! sources="$(timeout 60 docker inspect --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' $ids 2>/dev/null)"; then
        RAISON_USAGE="docker inspect en échec"; return 0
      fi
      while IFS= read -r s; do
        [ -z "$s" ] && continue
        case "$d" in "$s"|"$s"/*) RAISON_USAGE="monté dans un conteneur ($s)"; return 0 ;; esac
        case "$s" in "$d"/*) RAISON_USAGE="monté dans un conteneur ($s)"; return 0 ;; esac
      done <<< "$sources"
    fi
  fi
  return 1
}

# Échappe \, tabulation et saut de ligne dans des enregistrements séparés par NUL.
echapper0() { sed -z 's/\\/\\\\/g; s/\t/\\t/g; s/\n/\\n/g'; }

# Écrit le manifeste de TOUT le dossier dans $2 ; prépare $TRAVAIL/{reg.paths0,reg.hashes}.
# Retour : 0 ok ; 1 manifeste incomplet (le dossier sera gardé). $TRAVAIL/hash_ok = 1 si les
# empreintes de tous les fichiers réguliers ont été calculées.
fabriquer_manifeste() {
  local d="$1" out="$2" n_reg n_h
  local recs="$TRAVAIL/reg.recs0"
  : > "$TRAVAIL/hash_ok"
  printf 'type\tempreinte_git\tmode\ttaille\tdate\tchemin_relatif\n' > "$out" || return 1
  # Fichiers réguliers : métadonnées, puis empreintes (git hash-object, sans filtre).
  ( cd "$d" && find . -type f -printf '%m\037%s\037%TY-%Tm-%TdT%TH:%TM:%TS\037%P\0' ) > "$recs" 2>"$TRAVAIL/find.err" || { log "find (manifeste) en échec sur $d"; return 1; }
  # Chaque écriture intermédiaire est contrôlée (disque plein) : tout écart = manifeste incomplet.
  sed -z 's/^[^\x1f]*\x1f[^\x1f]*\x1f[^\x1f]*\x1f//' < "$recs" > "$TRAVAIL/reg.paths0" || { log "écriture des chemins en échec (disque plein ?) sur $d"; return 1; }
  n_reg="$(tr -cd '\0' < "$recs" | wc -c)"
  [ "$(tr -cd '\0' < "$TRAVAIL/reg.paths0" | wc -c)" -eq "$n_reg" ] || { log "liste des chemins incomplète sur $d (disque plein ?)"; return 1; }
  if [ "$n_reg" -gt 0 ]; then
    if ( cd "$d" && xargs -0 git hash-object --no-filters -- < "$TRAVAIL/reg.paths0" ) > "$TRAVAIL/reg.hashes" 2>"$TRAVAIL/hash.err" \
       && n_h="$(wc -l < "$TRAVAIL/reg.hashes")" && [ "$n_h" -eq "$n_reg" ]; then
      echo 1 > "$TRAVAIL/hash_ok"
      echapper0 < "$recs" | tr '\0\037' '\n\t' | paste -d'\t' "$TRAVAIL/reg.hashes" - | sed 's/^/f\t/' >> "$out" || { log "écriture du manifeste en échec sur $d"; return 1; }
    else
      log "doute sur les empreintes de $d ($(head -c 150 "$TRAVAIL/hash.err" 2>/dev/null)) : tout sera archivé"
      echapper0 < "$recs" | tr '\0\037' '\n\t' | sed 's/^/f\t?\t/' >> "$out" || { log "écriture du manifeste en échec sur $d"; return 1; }
    fi
  else
    : > "$TRAVAIL/reg.hashes"; echo 1 > "$TRAVAIL/hash_ok"
  fi
  # Liens, dossiers et autres entrées : type, -, mode, taille, date, chemin (lien -> cible).
  ( cd "$d" && find . -mindepth 1 ! -type f -printf '%y\037-\037%m\037%s\037%TY-%Tm-%TdT%TH:%TM:%TS\037%P\036%l\0' ) > "$TRAVAIL/autres.recs0" 2>>"$TRAVAIL/find.err" \
    || { log "find (liens/dossiers) en échec sur $d"; return 1; }
  sed -z 's/\x1e$//; s/\x1e/ -> /' < "$TRAVAIL/autres.recs0" | echapper0 | tr '\0\037' '\n\t' >> "$out" || { log "écriture du manifeste en échec sur $d"; return 1; }
  # Contrôle final : 1 ligne d'en-tête + 1 par fichier + 1 par autre entrée.
  local n_autres n_lignes
  n_autres="$(tr -cd '\0' < "$TRAVAIL/autres.recs0" | wc -c)"
  n_lignes="$(wc -l < "$out")"
  if [ "$n_lignes" -ne $((1 + n_reg + n_autres)) ]; then
    log "manifeste de $d incomplet : ${n_lignes} lignes au lieu de $((1 + n_reg + n_autres)) (disque plein ?)"; return 1
  fi
  return 0
}

# Contrôle INDÉPENDANT juste avant suppression de $1 (dossier courant, peut être renommé) dont les
# chemins d'origine sont sous $2, archive $3 : chaque fichier régulier doit avoir son empreinte dans
# l'ensemble connu OU figurer dans l'archive. Recalcule tout, sans réutiliser les listes du passage.
verifier_independant() {
  local cur="$1" orig="$2" archive="$3" w="$TRAVAIL/ind" n n_h
  mkdir -p "$w" || return 1
  ( cd "$cur" && find . -type f -print0 ) > "$w/noms0" 2>/dev/null || return 1
  n="$(tr -cd '\0' < "$w/noms0" | wc -c)"
  [ "$n" -eq 0 ] && return 0
  sed -z 's#^\./##' < "$w/noms0" > "$w/rel0" || return 1
  [ "$(tr -cd '\0' < "$w/rel0" | wc -c)" -eq "$n" ] || return 1
  ( cd "$cur" && xargs -0 git hash-object --no-filters -- < "$w/rel0" ) > "$w/h" 2>/dev/null || return 1
  n_h="$(wc -l < "$w/h")"; [ "$n_h" -eq "$n" ] || return 1
  awk '{printf "%s\t%d\n", $1, NR}' "$w/h" | sort -t $'\t' -k1,1 > "$w/idx" || return 1
  # Numéros des fichiers dont l'empreinte n'est PAS connue.
  join -t $'\t' -v 2 -1 1 -2 1 "$CONNUS" "$w/idx" | cut -f2 > "$w/inconnus.n" || return 1
  [ -s "$w/inconnus.n" ] || return 0
  # Noms (chemin d'origine, sans « / » initial) de ces fichiers, comparés à la liste de l'archive.
  awk -v RS='\0' -v ORS='\n' -v pre="${orig#/}/" 'NR==FNR { sel[$1]=1; next } (FNR in sel) { print pre $0 }' \
    <(tr '\n' '\0' < "$w/inconnus.n") "$w/rel0" > "$w/attendus" || return 1
  tar --quoting-style=literal -tzf "$archive" > "$w/dans-archive" 2>/dev/null || return 1
  sort -u "$w/dans-archive" > "$w/dans-archive.s" && sort -u "$w/attendus" > "$w/attendus.s" || return 1
  # Tout nom attendu doit être dans l'archive (un nom à saut de ligne ne se retrouve pas : échec prudent).
  [ -z "$(comm -23 "$w/attendus.s" "$w/dans-archive.s" | head -n 1)" ]
}

traiter() {
  local d="$1" nom taille_mo libre_mo
  nom="${d#"$TMP_DIR"/}"

  case "$nom" in
    .menage-supp-*) log "ANOMALIE : reste d'interruption $nom (nom d'origine : voir « mis de côté » dans le journal), à traiter à la main"; return ;;
  esac
  if protege "$nom"; then log "PROTÉGÉ (liste blanche) : $nom"; return; fi
  # Une archive .partiel existe déjà pour ce dossier : anomalie déjà signalée, on ne réarchive pas
  # (sinon une archive pleine taille serait recréée chaque nuit jusqu'à remplir le disque).
  local p
  for p in "$ARCHIVES"/*-"$nom".tar.gz.partiel "$ARCHIVES"/*-"$nom"-[0-9][0-9][0-9][0-9][0-9][0-9].tar.gz.partiel; do
    if [ -e "$p" ]; then log "ANOMALIE déjà signalée ($p) : $nom laissé en place, pas de nouvelle archive (traiter à la main)"; return; fi
  done
  if [ -L "$d" ] || mountpoint -q "$d" 2>/dev/null; then log "ignoré (lien ou point de montage) : $nom"; return; fi
  if ! taille_mo="$(du -sxm "$d" 2>/dev/null | cut -f1)" || [ -z "$taille_mo" ]; then
    log "ANOMALIE : du en échec sur $nom : laissé en place"; return
  fi
  [ "$taille_mo" -lt "$TAILLE_MIN_MO" ] && return
  # « Plus de N jours » : rien dans le dossier (ni lui-même) modifié (mtime) ni changé (ctime).
  if recent "$d"; then
    log "trop récent ou find en échec (mtime ou ctime depuis moins de ${AGE_JOURS} j) : $nom (${taille_mo} Mo), laissé en place"; return
  fi
  if utilise "$d"; then log "UTILISÉ ($RAISON_USAGE) : $nom (${taille_mo} Mo), laissé en place"; return; fi

  # Manifeste de tout le dossier (en mode essai : dans l'espace de travail, rien n'est créé ailleurs).
  local manifeste archive
  if [ "$ESSAI" = 1 ]; then
    manifeste="$TRAVAIL/manifeste.tsv"; archive="${ARCHIVES}/${DATE}-${nom}.tar.gz"
  else
    if ! { mkdir -p "$ARCHIVES" && chmod 700 "$ARCHIVES"; }; then log "ANOMALIE : $ARCHIVES inutilisable : $nom laissé en place"; return; fi
    archive="${ARCHIVES}/${DATE}-${nom}.tar.gz"
    if [ -e "$archive" ] || [ -e "$archive.partiel" ]; then archive="${ARCHIVES}/${DATE}-${nom}-$(date +%H%M%S).tar.gz"; fi
    manifeste="${archive%.tar.gz}.MANIFESTE.tsv"
  fi
  if ! fabriquer_manifeste "$d" "$manifeste"; then log "ANOMALIE : manifeste incomplet pour $nom : laissé en place"; return; fi
  local nb_total
  nb_total="$(( $(wc -l < "$manifeste") - 1 ))"

  # Fichiers réguliers ABSENTS des objets atteignables depuis la branche principale.
  local a0="$TRAVAIL/a-archiver0" nb_reg_inconnus=0 nb_liens
  : > "$a0"
  if [ "$(cat "$TRAVAIL/hash_ok")" = 1 ] && [ "$NB_DEPOTS" -gt 0 ] && [ -s "$TRAVAIL/reg.hashes" ]; then
    awk '{printf "%s\t%d\n", $1, NR}' "$TRAVAIL/reg.hashes" | sort -t $'\t' -k1,1 > "$TRAVAIL/reg.idx"
    join -t $'\t' -v 2 -1 1 -2 1 "$CONNUS" "$TRAVAIL/reg.idx" | cut -f2 | tr '\n' '\0' > "$TRAVAIL/inconnus.n0"
    awk -v RS='\0' -v ORS='\0' -v pre="${d#/}/" 'NR==FNR { sel[$1]=1; next } (FNR in sel) { print pre $0 }' \
      "$TRAVAIL/inconnus.n0" "$TRAVAIL/reg.paths0" >> "$a0"
    nb_reg_inconnus="$(tr -cd '\0' < "$TRAVAIL/inconnus.n0" | wc -c)"
  else
    awk -v RS='\0' -v ORS='\0' -v pre="${d#/}/" '{ print pre $0 }' "$TRAVAIL/reg.paths0" >> "$a0"
    nb_reg_inconnus="$(tr -cd '\0' < "$TRAVAIL/reg.paths0" | wc -c)"
  fi
  # Les liens symboliques sont toujours archivés.
  ( cd "$d" && find . -type l -print0 ) > "$TRAVAIL/liens0" 2>"$TRAVAIL/find.err" \
    || { log "ANOMALIE : find (liens) en échec sur $nom : laissé en place"; return; }
  awk -v RS='\0' -v ORS='\0' -v pre="${d#/}/" '{ sub(/^\.\//, ""); print pre $0 }' "$TRAVAIL/liens0" >> "$a0"
  nb_liens="$(tr -cd '\0' < "$TRAVAIL/liens0" | wc -c)"
  # Le manifeste lui-même est dans l'archive.
  local nb_attendu=$((nb_reg_inconnus + nb_liens + 1))
  if [ "$(tr -cd '\0' < "$a0" | wc -c)" -ne $((nb_reg_inconnus + nb_liens)) ]; then
    log "ANOMALIE : liste à archiver incomplète pour $nom (disque plein ?) : laissé en place"; return
  fi

  log "candidat : $nom (${taille_mo} Mo) ; ${nb_total} entrées au manifeste, $((nb_reg_inconnus + nb_liens)) à archiver (absentes de la branche principale, ou liens)"

  if [ "$ESSAI" = 1 ]; then
    log "  ESSAI : écrirait le manifeste, archiverait dans ${archive} puis supprimerait $d"
    return
  fi

  # Place suffisante pour l'archive (pire cas : taille du dossier) + 2 Go de marge ?
  libre_mo="$(df -Pm "$ARCHIVES" | awk 'NR==2 {print $4}')"
  if [ "${libre_mo:-0}" -lt $((taille_mo + 2048)) ]; then
    log "ANOMALIE : place insuffisante pour archiver $nom (libre ${libre_mo} Mo) : laissé en place"; return
  fi

  printf '%s\0' "${manifeste#/}" >> "$a0"
  chmod 600 "$manifeste"
  local echec="" nb_dans
  if ! tar --null --no-recursion -czf "$archive" -C / -T "$a0" 2>"$TRAVAIL/tar.err"; then
    echec="tar a échoué ($(head -c 200 "$TRAVAIL/tar.err"))"
  elif ! gzip -t "$archive" 2>/dev/null; then
    echec="archive corrompue (gzip -t)"
  else
    nb_dans="$(tar --quoting-style=escape -tzf "$archive" 2>/dev/null | wc -l)"
    if [ "$nb_dans" -ne "$nb_attendu" ]; then echec="${nb_dans} entrées au lieu de ${nb_attendu}"
    elif ! tar -xOzf "$archive" "${manifeste#/}" 2>/dev/null | cmp -s - "$manifeste"; then echec="manifeste absent de l'archive ou différent"
    elif ! tar -dzf "$archive" -C / >"$TRAVAIL/tar-d.out" 2>&1; then echec="comparaison du contenu en échec ($(head -c 200 "$TRAVAIL/tar-d.out"))"
    fi
  fi
  if [ -n "$echec" ]; then
    [ -e "$archive" ] && mv -f "$archive" "$archive.partiel"
    log "ANOMALIE : $echec : archive renommée .partiel, $nom laissé en place"; return
  fi
  chmod 600 "$archive"
  log "  archive vérifiée (gzip -t, liste, comparaison tar -d) : $archive (${nb_attendu} entrées dont le manifeste ${manifeste})"

  # Dernière garde avant suppression. Ordre : usage, puis mise de côté ATOMIQUE (renommage), puis
  # nouveaux contrôles sur le dossier renommé (un processus qui l'aurait ouvert se retrouve sous le
  # nouveau nom), puis contrôle indépendant, puis seulement rm. Au moindre doute on remet le nom d'origine.
  if utilise "$d"; then log "ANOMALIE : $nom est devenu utilisé ($RAISON_USAGE) pendant l'archivage : laissé en place (archive conservée : $archive)"; return; fi
  local supp="$TMP_DIR/.menage-supp-$$"
  if [ -e "$supp" ]; then log "ANOMALIE : $supp existe déjà : $nom laissé en place"; return; fi
  log "  mis de côté : $d -> $supp (archive $archive)"
  if ! mv -T -- "$d" "$supp"; then log "ANOMALIE : renommage de $nom impossible : laissé en place"; return; fi
  local doute=""
  if recent "$supp"; then doute="a changé pendant l'archivage (ou find en échec)"
  elif utilise "$supp"; then doute="utilisé ($RAISON_USAGE)"
  elif ! verifier_independant "$supp" "$d" "$archive"; then doute="contrôle indépendant (empreinte connue ou présent dans l'archive) en échec"
  fi
  if [ -n "$doute" ]; then
    if mv -T -- "$supp" "$d"; then log "ANOMALIE : $nom $doute : nom d'origine rétabli, laissé en place"
    else log "ANOMALIE GRAVE : $nom $doute ET retour au nom d'origine impossible : dossier à $supp, ne rien supprimer"; fi
    case "$doute" in contrôle*) [ -e "$archive" ] && mv -f "$archive" "$archive.partiel" ;; esac
    return
  fi
  if rm -rf --one-file-system -- "$supp"; then
    log "  supprimé : $d (${taille_mo} Mo libérés)"
  else
    log "ANOMALIE : suppression incomplète de $supp (reste à terminer à la main, l'archive $archive est vérifiée)"
  fi
}

LISTE_DOSSIERS="$TRAVAIL/dossiers0"
if ! find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d -print0 > "$LISTE_DOSSIERS" 2>"$TRAVAIL/find.err"; then
  log "find sur $TMP_DIR en échec ($(head -c 150 "$TRAVAIL/find.err")) : liste peut-être incomplète, on traite ce qui est lisible"
fi
while IFS= read -r -d '' dossier; do
  case "$dossier" in "$TMP_DIR"/*) traiter "$dossier" ;; esac
done < "$LISTE_DOSSIERS"

log "terminé"
