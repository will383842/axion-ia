#!/usr/bin/env bash
# Backup des PIÈCES LÉGALES et des PREUVES écrites par l'application sur R2.
#
# 🔴 P0 — constat `D66-01` de l'audit Qualiopi E2E du 2026-08-19.
#
# Avant ce script, `BackupComponent` déclarait neuf composants et AUCUN ne visait
# le bucket applicatif. Or c'est là que vivent les preuves :
#
#   documents/    conventions, contrats, attestations, certificats, factures
#   supports/     supports pédagogiques et grilles d'évaluation
#   emargement/   images de signature et de contresignature
#
# **Le bucket R2 est la DESTINATION des sauvegardes, et il n'était lui-même
# sauvegardé par rien.** S'il disparaît — clé compromise, règle de cycle de vie
# mal posée, suppression — Postgres survit avec `document_hash_sha256` et
# `signature_sha256` intacts : des empreintes de fichiers que plus personne ne
# peut produire, et un `signatureKey` qui pointe dans le vide. L'organisme
# dispose alors d'un registre prouvant qu'il A EU des pièces et n'en a plus
# aucune, alors que la rétention légale est de cinq ans.
#
# ⚠️ La destination DOIT être un bucket DIFFERENT (`R2_BUCKET_IMMUTABLE`).
# Copier à l'intérieur du bucket source ne serait pas une sauvegarde : les deux
# copies mourraient du même geste. C'est pourquoi la variable est `require_var`
# et non optionnelle, contrairement aux autres scripts où elle ne sert qu'au
# durcissement mensuel.
#
# Variables requises :
#   R2_* (ACCESS_KEY_ID / SECRET_ACCESS_KEY / BUCKET_NAME / ENDPOINT)
#   R2_BUCKET_IMMUTABLE  — bucket de destination, distinct de R2_BUCKET_NAME
# Optionnel : TELEGRAM_*, HEALTHCHECK_URL_FILES_DOCUMENTS, BACKUP_REPORT_*
#
# Usage :
#   bash scripts/backup-documents-r2.sh
#   bash scripts/backup-documents-r2.sh --type monthly

set -euo pipefail

COMPONENT="files_documents"
COMPONENT_LABEL="DOCUMENTS"
args=("$@")
for i in "${!args[@]}"; do
  case "${args[$i]}" in
    --type) BACKUP_TYPE="${args[$((i+1))]:-daily}" ;;
  esac
done
BACKUP_TYPE="${BACKUP_TYPE:-daily}"
source "$(dirname "$0")/backup-lib.sh"

# ⚠️ Cette liste est GARDÉE : `tests/unit/ci/sauvegardes-couvrent-le-bucket.spec.ts`
# extrait les préfixes réellement écrits par le code applicatif et exige que
# chacun soit nommé ici. Ajouter un préfixe R2 dans le code sans l'ajouter ici
# fait rougir la garde — c'est le but.
PREFIXES=(documents supports emargement)

healthcheck_ping "/start"
require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY
require_var R2_BUCKET_NAME
require_var R2_ENDPOINT
require_var R2_BUCKET_IMMUTABLE

if [ "${R2_BUCKET_IMMUTABLE}" = "${R2_BUCKET_NAME}" ]; then
  echo "❌ R2_BUCKET_IMMUTABLE est identique à R2_BUCKET_NAME : ce ne serait pas une sauvegarde."
  record_fail "destination_identique_a_la_source"
  exit 1
fi

START_TS=$(date +%s)
SIZE_BYTES=0

NB_NOUVEAUX=0
NB_VERSIONNES=0

# ⚠️ PAS de `--delete`. Une pièce retirée de la source ne doit pas disparaître
# de la sauvegarde : c'est précisément le cas d'une suppression accidentelle,
# celui contre lequel cette sauvegarde existe.
#
# 🔴 ET PAS DE `s3 sync` NON PLUS — mesuré le 2026-09-20 sur le bucket réel.
# Le verrou du bucket (`retention-1-an`) refuse le REMPLACEMENT autant que la
# suppression :
#
#     1er envoi            -> OK
#     2e envoi, même clé   -> ObjectLockedByBucketPolicy
#     suppression          -> ObjectLockedByBucketPolicy
#
# Or l'application REGENERE des pièces sous le même nom : une convocation
# corrigée, un émargement refait. `sync` aurait donc échoué dès la première
# pièce modifiée — et comme l'échec sortait en `exit 1`, c'est le miroir ENTIER
# qui se serait arrêté, en laissant croire qu'il tournait.
#
# On ne remplace donc JAMAIS : un objet déjà présent dont le contenu diffère est
# déposé sous une clé datée. Les deux versions coexistent, chacune verrouillée
# pour la durée du bucket — ce qu'on veut d'une sauvegarde de preuves :
# l'historique, pas le dernier état.
for prefixe in "${PREFIXES[@]}"; do
  SRC="s3://${R2_BUCKET_NAME}/${prefixe}/"
  DST="s3://${R2_BUCKET_IMMUTABLE}/${COMPONENT}/${prefixe}/"
  echo "-> miroir ${SRC} vers ${DST}"

  # `--dryrun` donne les CANDIDATS sans rien écrire. ⚠️ Il en signale plus que
  # nécessaire : la clé nue n'étant jamais réécrite, toute pièce déjà modifiée
  # y figure à chaque passage. C'est la comparaison d'EMPREINTES ci-dessous
  # qui tranche, et qui garantit qu'un passage sans changement ne copie rien.
  A_COPIER=$(s3 s3 sync "${SRC}" "${DST}" --dryrun 2>/dev/null \
    | awk '/^\(dryrun\) copy:/ {print $3}') \
    || { record_fail "s3_dryrun_failed:${prefixe}"; exit 1; }

  while IFS= read -r src_uri; do
    [ -z "${src_uri}" ] && continue
    rel="${src_uri#"${SRC}"}"
    cle="${COMPONENT}/${prefixe}/${rel}"

    # 🔴 L'EMPREINTE, PAS LA DATE — corrigé le 2026-09-20 avant la fusion.
    #
    # Une première version nommait la copie `<cle>.__v<DATE_TAG>`. Elle créait
    # une croissance SANS FIN : `sync --dryrun` compare la source à la clé `X`,
    # or on n'écrit JAMAIS sur `X` (le verrou l'interdit), donc `X` garde pour
    # toujours les octets du premier passage. Une pièce régénérée une fois
    # serait donc re-signalée à CHAQUE passage, et déposée sous une date
    # nouvelle à chaque fois : 365 objets immuables par an au lieu de 2, et
    # aucun effaçable. Le défaut ne pouvait pas se voir au premier passage.
    #
    # La clé dérivée de l'EMPREINTE rend l'opération idempotente : même
    # contenu -> même clé -> déjà présente -> rien à faire. Contenu
    # différent -> clé différente -> une seule copie, pour toujours.
    #
    # ⚠️ `head-object` distingue le 404 des AUTRES erreurs. Avaler les deux
    # ferait lire « absent » sur une panne réseau, donc tenter d'écrire sur la
    # clé nue déjà verrouillée, donc arrêter le miroir entier. Un prédicat
    # ouvert échoue ouvert.
    # `--query ETag --output text` : on récupère l'empreinte SEULE, sans traverser
    # le JSON — dont les guillemets échappés casseraient tout filtre naïf.
    rep=$(s3 s3api head-object --bucket "${R2_BUCKET_IMMUTABLE}" --key "${cle}" \
      --query 'ETag' --output text 2>&1) && present=1 || present=0
    if [ "${present}" -eq 0 ] && ! printf '%s' "${rep}" | grep -qE '404|Not Found'; then
      record_fail "head_object_indecis:${prefixe}"
      echo "head-object a echoue sans dire 404 : ${rep}" >&2
      exit 1
    fi

    if [ "${present}" -eq 1 ]; then
      # Déjà sauvegardé. La pièce a-t-elle vraiment changé ?
      etag_dst=$(printf '%s' "${rep}" | tr -cd 'a-zA-Z0-9')
      etag_src=$(s3 s3api head-object --bucket "${R2_BUCKET_NAME}" --key "${prefixe}/${rel}" \
        --query 'ETag' --output text 2>/dev/null | tr -cd 'a-zA-Z0-9')
      if [ -z "${etag_src}" ]; then
        record_fail "etag_source_illisible:${prefixe}"
        exit 1
      fi
      # Même contenu que la copie nue : rien à faire, et surtout rien à dupliquer.
      [ "${etag_src}" = "${etag_dst}" ] && continue

      dst_uri="${DST}${rel}.__e${etag_src}"
      # Cette version-là est-elle déjà déposée ? Alors on n'y touche pas.
      if s3 s3api head-object --bucket "${R2_BUCKET_IMMUTABLE}" \
           --key "${cle}.__e${etag_src}" >/dev/null 2>&1; then
        continue
      fi
      NB_VERSIONNES=$(( NB_VERSIONNES + 1 ))
    else
      dst_uri="${DST}${rel}"
      NB_NOUVEAUX=$(( NB_NOUVEAUX + 1 ))
    fi

    s3 s3 cp "${src_uri}" "${dst_uri}" >/dev/null \
      || { record_fail "s3_cp_failed:${prefixe}"; exit 1; }
  done <<< "${A_COPIER}"

  # Volumétrie best-effort : un échec de mesure ne doit pas faire échouer une
  # sauvegarde qui, elle, a réussi.
  TAILLE=$(s3 s3 ls --summarize --recursive "s3://${R2_BUCKET_IMMUTABLE}/${COMPONENT}/${prefixe}/" 2>/dev/null \
    | awk '/Total Size:/ {print $3}' || echo 0)
  SIZE_BYTES=$(( SIZE_BYTES + ${TAILLE:-0} ))
done

DURATION=$(( $(date +%s) - START_TS ))
SIZE_HUMAN=$(awk -v b="${SIZE_BYTES}" 'BEGIN{ if (b>1073741824) printf "%.1fG", b/1073741824; else if (b>1048576) printf "%.1fM", b/1048576; else printf "%.0fK", b/1024 }')
REMOTE_KEY="${COMPONENT}/"
DEST="r2_immutable"

record_success
report_backup_run "success" "${SIZE_BYTES}" "${DURATION}" "${DEST}" "${REMOTE_KEY}"
healthcheck_ping
notify_telegram "OK ${BACKUP_TYPE} · ${SIZE_HUMAN} · ${DURATION}s · ${NB_NOUVEAUX} nouvelle(s), ${NB_VERSIONNES} version(s)" "🟢"
echo "✅ Backup pièces légales OK : ${REMOTE_KEY} (${SIZE_HUMAN}, ${DURATION}s)"
echo "   ${NB_NOUVEAUX} piece(s) nouvelle(s), ${NB_VERSIONNES} version(s) deposee(s) a cote de l existant."
