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

for prefixe in "${PREFIXES[@]}"; do
  echo "→ sync s3://${R2_BUCKET_NAME}/${prefixe}/ → s3://${R2_BUCKET_IMMUTABLE}/${COMPONENT}/${prefixe}/"
  # ⚠️ PAS de `--delete`. Une pièce retirée de la source ne doit pas disparaître
  # de la sauvegarde : c'est précisément le cas d'une suppression accidentelle,
  # celui contre lequel cette sauvegarde existe. La rotation est assurée par le
  # cycle de vie du bucket immuable, pas par le miroir.
  s3 s3 sync "s3://${R2_BUCKET_NAME}/${prefixe}/" \
             "s3://${R2_BUCKET_IMMUTABLE}/${COMPONENT}/${prefixe}/" \
    || { record_fail "s3_sync_failed:${prefixe}"; exit 1; }

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
notify_telegram "OK ${BACKUP_TYPE} · ${SIZE_HUMAN} · ${DURATION}s" "🟢"
echo "✅ Backup pièces légales OK : ${REMOTE_KEY} (${SIZE_HUMAN}, ${DURATION}s)"
