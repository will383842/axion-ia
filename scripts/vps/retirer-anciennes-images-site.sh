#!/usr/bin/env bash
# retirer-anciennes-images-site.sh — Retire les ANCIENNES images du site (app Coolify) sur le VPS,
# une fois la nouvelle image servie et saine. Appelé par le job `deploy` de deploy-coolify.yml
# (étape « Retirer l'ancienne image du site », via SSH, script lu sur l'entrée standard) ; peut
# aussi se lancer à la main.
#
# Usage :
#   retirer-anciennes-images-site.sh [--essai] <APP_UUID>      # défaut : n'efface RIEN, journalise
#   retirer-anciennes-images-site.sh --appliquer <APP_UUID>    # retire réellement
#
# Constat serveur (15/11/2026) : les images du site s'appellent <APP_UUID>:<sha-de-commit-40-car>
# (stockage containerd/overlayfs) ; l'image tirée de GHCR s'appelle ghcr.io/will383842/axion-ia:*.
#
# Garde-fous, dans l'ordre :
#   1. un seul passage à la fois (flock) ; verrou déjà pris = sortie 0 sans rien faire ;
#   2. garde de santé : il faut au moins un conteneur EN COURS dont le nom commence par APP_UUID
#      et qui est « healthy » ; sinon sortie 0 ;
#   3. attente (10 min max, relevé toutes les 20 s) que plus aucun conteneur APP_UUID* en cours
#      n'utilise une autre image que celle du conteneur sain ; sinon sortie 0, rien retiré ;
#   4. GARDÉES : toute image utilisée par N'IMPORTE QUEL conteneur (même arrêté) + l'image
#      ghcr.io/will383842/axion-ia:latest ; en plus, une candidate n'est retirable que si son
#      .Created est ANTÉRIEUR à celui de l'image du conteneur sain (une image en cours de
#      déploiement n'est jamais candidate), et la plus récente des images APP_UUID:* non
#      servies est gardée (retour arrière Coolify, N=1) ;
#   5. CANDIDATES : étiquette APP_UUID:* ou ghcr.io/will383842/axion-ia:*, ou condensat
#      ghcr.io/will383842/axion-ia@* ;
#   6. liste noire : si une étiquette ou un condensat d'une candidate contient l'un des mots
#      studio, cv-storage, backup, sauvegarde, f0-facecam, medias-reels, contenu-reel,
#      avant-reconciliation, coolify, postgres : ABANDON TOTAL, sortie 0, rien retiré ;
#   7. retrait par `docker rmi` SIMPLE (jamais forcé) ; un échec est journalisé, sans arrêt ;
#      retrait par référence : si l'image existe encore après coup (`docker image inspect`),
#      « étiquette retirée, image gardée » et elle n'est pas comptée comme retirée.
# (Le contrôle « aucun déploiement Coolify actif » est fait par le workflow avant l'appel.)
# Ne touche jamais aux conteneurs, aux données Docker, à /root ni à /tmp.
# Journal : /var/log/axion-retrait-images.log (df -h / avant et après, gardées / retirées).

set -euo pipefail
export LC_ALL=C

DEPOT_GHCR="ghcr.io/will383842/axion-ia"
LOG="${LOG:-/var/log/axion-retrait-images.log}"
VERROU="${VERROU:-/run/axion-retrait-images.lock}"
ATTENTE_MAX_S="${ATTENTE_MAX_S:-600}"
RELEVE_S="${RELEVE_S:-20}"
LISTE_NOIRE='studio|cv-storage|backup|sauvegarde|f0-facecam|medias-reels|contenu-reel|avant-reconciliation|coolify|postgres'

MODE="essai"
APP_UUID=""
for arg in "$@"; do
  case "$arg" in
    --essai) MODE="essai" ;;
    --appliquer) MODE="appliquer" ;;
    *) APP_UUID="$arg" ;;
  esac
done

if ! [[ "$APP_UUID" =~ ^[a-z0-9]{20,40}$ ]]; then
  echo "usage : $0 [--essai|--appliquer] <APP_UUID>  (APP_UUID : ^[a-z0-9]{20,40}\$)" >&2
  exit 2
fi

journal() {
  local ligne
  ligne="$(date -u +%FT%TZ) [$MODE] $*"
  echo "$ligne"
  echo "$ligne" >>"$LOG" 2>/dev/null || true
}

exec 9>"$VERROU"
flock -n 9 || exit 0

# --- 2 et 3 : garde de santé, puis attente que l'image servie soit unique -------------------
etat_conteneurs() { # imprime « nom<TAB>image<TAB>santé » pour les conteneurs en cours APP_UUID*
  local nom
  for nom in $(docker ps --format '{{.Names}}' | grep -E "^${APP_UUID}" || true); do
    docker inspect --format '{{.Name}}{{"\t"}}{{.Image}}{{"\t"}}{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$nom" 2>/dev/null || true
  done
}

pret=0
debut=$SECONDS
while :; do
  etat="$(etat_conteneurs)"
  sains="$(printf '%s\n' "$etat" | awk -F'\t' '$3=="healthy"' | grep -c . || true)"
  images="$(printf '%s\n' "$etat" | awk -F'\t' 'NF>=2 {print $2}' | sort -u | grep -c . || true)"
  if [ "${sains:-0}" -ge 1 ] && [ "${images:-0}" -eq 1 ]; then
    IMAGE_SAINE="$(printf '%s\n' "$etat" | awk -F'\t' '$3=="healthy" {print $2; exit}')"
    pret=1
    break
  fi
  if [ "${sains:-0}" -lt 1 ]; then
    journal "aucun conteneur ${APP_UUID}* en cours et healthy : sortie sans rien retirer"
    exit 0
  fi
  if [ $((SECONDS - debut)) -ge "$ATTENTE_MAX_S" ]; then
    journal "plusieurs images encore servies par ${APP_UUID}* après ${ATTENTE_MAX_S}s : sortie sans rien retirer"
    exit 0
  fi
  sleep "$RELEVE_S"
done
[ "$pret" -eq 1 ] || exit 0

journal "espace avant : $(df -h / | tail -1)"

# --- 4 : images gardées ---------------------------------------------------------------------
gardees="$(mktemp)"
trap 'rm -f "$gardees"' EXIT
for c in $(docker ps -a -q); do
  docker inspect --format '{{.Image}}' "$c" 2>/dev/null || true
  ref="$(docker inspect --format '{{.Config.Image}}' "$c" 2>/dev/null || true)"
  [ -n "$ref" ] && { docker image inspect --format '{{.Id}}' "$ref" 2>/dev/null || true; }
done >"$gardees"
docker image inspect --format '{{.Id}}' "${DEPOT_GHCR}:latest" >>"$gardees" 2>/dev/null || true
sort -u -o "$gardees" "$gardees"

# --- 5 et 6 : candidates et liste noire -----------------------------------------------------
# Horodatage de création en nanosecondes (comparaison numérique, formats RFC3339 variables).
cree_ns() { # $1 = id d'image ; imprime des ns depuis l'époque, ou rien si illisible
  local c
  c="$(docker image inspect --format '{{.Created}}' "$1" 2>/dev/null || true)"
  [ -n "$c" ] || return 0
  date -u -d "$c" +%s%N 2>/dev/null || true
}
CREE_SAINE="$(cree_ns "$IMAGE_SAINE")"
if ! [[ "$CREE_SAINE" =~ ^[0-9]+$ ]]; then
  journal "date de création de l'image saine illisible : sortie sans rien retirer"
  exit 0
fi

ids="$(docker image ls -q --no-trunc | sort -u || true)"
retirables=()
for id in $ids; do
  fiche="$(docker image inspect --format '{{.Id}}{{"\t"}}{{join .RepoTags " "}}{{"\t"}}{{join .RepoDigests " "}}' "$id" 2>/dev/null || true)"
  [ -n "$fiche" ] || continue
  refs="$(printf '%s' "$fiche" | awk -F'\t' '{print $2" "$3}')"
  candidate=0
  for r in $refs; do
    case "$r" in
      "${APP_UUID}:"* | "${DEPOT_GHCR}:"* | "${DEPOT_GHCR}@"*) candidate=1 ;;
    esac
  done
  [ "$candidate" -eq 1 ] || continue
  if printf '%s' "$refs" | grep -qiE "$LISTE_NOIRE"; then
    journal "ABANDON TOTAL : une candidate porte un nom de la liste noire (${refs}) ; rien retiré"
    exit 0
  fi
  if grep -qxF "$id" "$gardees"; then
    journal "gardée : ${refs}"
    continue
  fi
  cree="$(cree_ns "$id")"
  if ! [[ "$cree" =~ ^[0-9]+$ ]] || [ "$cree" -ge "$CREE_SAINE" ]; then
    journal "gardée (pas antérieure à l'image saine, ou date illisible) : ${refs}"
    continue
  fi
  retirables+=("${cree}|${id}|${refs}")
done

# Retour arrière Coolify (N=1) : on garde la plus récente des images APP_UUID:* non servies.
recente=""
recente_ns=0
for entree in "${retirables[@]:-}"; do
  [ -n "$entree" ] || continue
  ns="${entree%%|*}"
  reste="${entree#*|}"
  case "${reste#*|}" in
    "${APP_UUID}:"* | *" ${APP_UUID}:"*)
      if [ "$ns" -gt "$recente_ns" ]; then recente_ns="$ns"; recente="$entree"; fi
      ;;
  esac
done
if [ -n "$recente" ]; then
  journal "gardée (retour arrière, la plus récente non servie) : ${recente#*|*|}"
  filtre=()
  for entree in "${retirables[@]}"; do
    [ "$entree" = "$recente" ] || filtre+=("$entree")
  done
  retirables=()
  if [ "${#filtre[@]}" -gt 0 ]; then retirables=("${filtre[@]}"); fi
fi

journal "gardées : $(grep -c . "$gardees" || true) identifiants ; à retirer : ${#retirables[@]}"

# --- 7 : retrait simple ---------------------------------------------------------------------
retirees=0
for entree in "${retirables[@]:-}"; do
  [ -n "$entree" ] || continue
  entree="${entree#*|}"
  id="${entree%%|*}"
  refs="${entree#*|}"
  if [ "$MODE" != "appliquer" ]; then
    journal "SERAIT retirée : ${refs} (${id})"
    continue
  fi
  if docker rmi "$id" >/dev/null 2>&1; then
    journal "retirée : ${refs}"
    retirees=$((retirees + 1))
  else
    # Image portant plusieurs étiquettes : on retire chaque référence candidate, toujours sans forcer.
    ok=0
    for r in $refs; do
      case "$r" in
        "${APP_UUID}:"* | "${DEPOT_GHCR}:"* | "${DEPOT_GHCR}@"*)
          if docker rmi "$r" >/dev/null 2>&1; then ok=1; fi
          ;;
      esac
    done
    if [ "$ok" -eq 1 ] && docker image inspect "$id" >/dev/null 2>&1; then
      journal "étiquette retirée, image gardée : ${refs}"
    elif [ "$ok" -eq 1 ]; then
      journal "retirée (par référence) : ${refs}"
      retirees=$((retirees + 1))
    else
      journal "ÉCHEC du retrait (image gardée) : ${refs}"
    fi
  fi
done

journal "retirées : ${retirees}"
journal "espace après : $(df -h / | tail -1)"
exit 0
