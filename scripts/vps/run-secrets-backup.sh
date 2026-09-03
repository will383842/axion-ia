#!/usr/bin/env bash
# Backup secrets/config chiffré AES -> R2 (off-Hetzner). ADR 0032.
# Déchiffrable avec BACKUP_ENCRYPTION_PASSPHRASE (la passphrase à garder en coffre).
#
# v2 (2026-09-03) — PÉRIMÈTRE INSTANCE ENTIÈRE.
#   v1 ne sauvegardait QUE /applications/$COOLIFY_APP_UUID/envs, c.-à-d. les
#   variables du site. Manquaient, entre autres, le SECRET_KEY_BASE de Docuseal
#   (sans lui la base Docuseal restaurée est illisible), les variables propres au
#   worker, les identifiants des bases Postgres/Redis et ceux de Plausible.
#   v2 énumère les 3 familles de ressources Coolify et prend TOUT, plus un
#   `printenv` par conteneur vivant (l'état réel, pas seulement la config).
#
# Le script se vérifie lui-même : marqueurs obligatoires avant l'envoi, puis
# re-téléchargement + déchiffrement + listage de l'archive après l'envoi. Cette
# relecture est remontée comme RestoreDrill : la restauration des secrets est
# donc prouvée CHAQUE JOUR, et non plus jamais.
set -euo pipefail

APP_UUID="mqbmlz1bcwsdwi3t9fxsllqt"
APP_CT=$(docker ps --filter "name=${APP_UUID}" --format '{{.Names}}' | head -1)
if [ -z "${APP_CT}" ]; then
  echo "❌ Conteneur applicatif ${APP_UUID} introuvable — impossible de lire les secrets d'amorçage."
  exit 1
fi
env_of() { docker exec "${APP_CT}" printenv "$1" 2>/dev/null || true; }

# Répertoire de travail root-only, détruit à la sortie (y compris sur erreur).
WORK=$(mktemp -d /tmp/axion-secrets.XXXXXXXX)
chmod 700 "${WORK}"
trap 'rm -rf "${WORK}"' EXIT
mkdir -p "${WORK}/payload/runtime-env" /var/lib/axion-backup

# ─── État réel : les variables telles que les conteneurs les voient ──────────
# Complète l'API Coolify : capture aussi ce que Coolify injecte lui-même et ce
# qu'un conteneur tient d'ailleurs. Un conteneur sans shell est ignoré.
RUNTIME_OK=0
for ct in $(docker ps --format '{{.Names}}'); do
  if docker exec "${ct}" printenv > "${WORK}/payload/runtime-env/${ct}.env" 2>/dev/null; then
    RUNTIME_OK=$((RUNTIME_OK + 1))
  else
    rm -f "${WORK}/payload/runtime-env/${ct}.env"
  fi
done
echo "ℹ️  printenv capturé sur ${RUNTIME_OK} conteneurs"

# ─── Corps exécuté dans le conteneur éphémère ────────────────────────────────
# Écrit dans un fichier puis monté : évite l'enfer des quotes d'un `bash -c '…'`.
cat > "${WORK}/inner.sh" <<'INNER'
set -euo pipefail
apk add --no-cache aws-cli openssl curl jq >/dev/null

export COMPONENT=secrets COMPONENT_LABEL=SECRETS HOSTNAME_TAG=vps
# Monté depuis l'hôte : sans cela le compteur de fails consécutifs naît et meurt
# avec le conteneur éphémère, et le « CASCADING FAIL » ne se déclenche jamais.
export FAIL_COUNT_FILE=/state/backup-fails-secrets-count.log
export DATE_TAG=$(date -u +%Y%m%d-%H%M%S)
curl -fsS https://raw.githubusercontent.com/will383842/axion-ia/main/scripts/backup-lib.sh -o /tmp/backup-lib.sh
source /tmp/backup-lib.sh

require_var BACKUP_ENCRYPTION_PASSPHRASE
require_var R2_ENDPOINT
require_var R2_BUCKET_NAME
require_var COOLIFY_API_TOKEN
require_var COOLIFY_URL
require_var COOLIFY_APP_UUID

START=$(date +%s)
API="${COOLIFY_URL%/}/api/v1"
api() { curl -fsS -m 30 -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" "${API}$1"; }

mkdir -p /payload/coolify
RESOURCES=0

# applications + services : les variables vivent sous /<famille>/<uuid>/envs
for FAMILY in applications services; do
  if ! api "/${FAMILY}" > "/payload/coolify/_${FAMILY}.json"; then
    echo "❌ Énumération ${FAMILY} impossible"; record_fail "coolify_list:${FAMILY}"
    report_backup_run "failed" null null "r2" "" "coolify_list:${FAMILY}"; exit 1
  fi
  for UUID in $(jq -r '.[].uuid' "/payload/coolify/_${FAMILY}.json"); do
    if api "/${FAMILY}/${UUID}/envs" > "/payload/coolify/${FAMILY}-${UUID}.json"; then
      RESOURCES=$((RESOURCES + 1))
    else
      echo "⚠️  envs indisponibles pour ${FAMILY}/${UUID}"
      rm -f "/payload/coolify/${FAMILY}-${UUID}.json"
    fi
  done
done

# bases : pas d'endpoint /envs, les identifiants sont dans l'objet lui-même
if ! api "/databases" > /payload/coolify/_databases.json; then
  echo "❌ Énumération databases impossible"; record_fail "coolify_list:databases"
  report_backup_run "failed" null null "r2" "" "coolify_list:databases"; exit 1
fi
for UUID in $(jq -r '.[].uuid' /payload/coolify/_databases.json); do
  if api "/databases/${UUID}" > "/payload/coolify/databases-${UUID}.json"; then
    RESOURCES=$((RESOURCES + 1))
  else
    echo "⚠️  détail indisponible pour databases/${UUID}"
    rm -f "/payload/coolify/databases-${UUID}.json"
  fi
done

# Compat descendante : R33 et les habitudes pointent sur ce nom-là.
if [ -f "/payload/coolify/applications-${COOLIFY_APP_UUID}.json" ]; then
  cp "/payload/coolify/applications-${COOLIFY_APP_UUID}.json" /payload/coolify-envs.json
else
  echo "❌ Variables du site (${COOLIFY_APP_UUID}) non récupérées"
  record_fail "coolify_envs:site_absent"
  report_backup_run "failed" null null "r2" "" "coolify_envs:site_absent"
  exit 1
fi

# Carte uuid → nom, pour retrouver quoi est quoi sans relire 3 index.
jq -s '[.[][] | {uuid, name, famille: (.database_type // "app_ou_service")}]' \
  /payload/coolify/_applications.json /payload/coolify/_services.json \
  /payload/coolify/_databases.json > /payload/INVENTAIRE.json

cat > /payload/README.txt <<TXT
Sauvegarde des secrets Axion-IA — instance Coolify entière
Prise le $(date -u) (UTC), depuis le VPS.

  coolify/applications-<uuid>.json  variables d'env de chaque application
  coolify/services-<uuid>.json      idem pour les services (Plausible)
  coolify/databases-<uuid>.json     objet complet des bases (mot de passe inclus)
  coolify/_*.json                   index bruts renvoyés par l'API
  coolify-envs.json                 alias historique = variables du site
  runtime-env/<conteneur>.env       printenv réel de chaque conteneur vivant
  INVENTAIRE.json                   carte uuid -> nom

Ressources Coolify capturées : ${RESOURCES}
Restauration : voir docs/runbooks/R33-disaster-recovery-cold-start.md, étape 1.
TXT

# ─── Garde : refuser d'envoyer une archive amputée ───────────────────────────
# Une sauvegarde de secrets qui a « réussi » sans contenir les secrets est pire
# que pas de sauvegarde du tout : elle éteint l'alerte.
fail_guard() {
  echo "❌ Garde de complétude : $1"
  record_fail "archive_incomplete:$1"
  report_backup_run "failed" null null "r2" "" "archive_incomplete:$1"
  exit 1
}
[ "${RESOURCES}" -ge 5 ] || fail_guard "seulement ${RESOURCES} ressources (attendu >= 5)"
grep -Rqs "BACKUP_ENCRYPTION_PASSPHRASE" /payload/coolify/ || fail_guard "variables du site absentes"
# Viser LA ressource Docuseal, pas « une ressource qui porte la clé » : Plausible
# déclare aussi un SECRET_KEY_BASE, et un grep global validerait le sien.
DOCUSEAL_UUID=$(jq -r '.[] | select((.name // "") | ascii_downcase | contains("docuseal")) | .uuid' \
  /payload/coolify/_applications.json | head -1)
[ -n "${DOCUSEAL_UUID}" ] || fail_guard "aucune application Docuseal dans l'inventaire"
jq -e '[.[] | select(.key == "SECRET_KEY_BASE") | (.real_value // .value // "")] | map(select(. != "")) | length > 0' \
  "/payload/coolify/applications-${DOCUSEAL_UUID}.json" >/dev/null \
  || fail_guard "SECRET_KEY_BASE de Docuseal absent ou vide"
grep -Rqs "postgres_password" /payload/coolify/ || fail_guard "identifiants de base absents"
RUNTIME_FILES=$(find /payload/runtime-env -name '*.env' | wc -l)
[ "${RUNTIME_FILES}" -ge 10 ] || fail_guard "seulement ${RUNTIME_FILES} printenv de conteneurs"

NAME="axion-ia-secrets-${DATE_TAG}-vps.tar.gz.enc"
tar -C /payload -cf - . | gzip -9 | encrypt_aes > "/tmp/${NAME}"
SIZE=$(stat -c%s "/tmp/${NAME}")
KEY="secrets/${NAME}"
upload_r2 "/tmp/${NAME}" "$R2_BUCKET_NAME" "$KEY"
prune_r2 "$R2_BUCKET_NAME" "secrets/" 30

# ─── Relecture : re-télécharger, déchiffrer, lister. Le drill quotidien ──────
DRILL_START=$(date +%s)
DRILL_STATUS="failed"; DRILL_REASON="init"
if s3 s3 cp "s3://${R2_BUCKET_NAME}/${KEY}" /tmp/verif.enc >/dev/null 2>&1; then
  if decrypt_aes < /tmp/verif.enc | gunzip | tar -tf - > /tmp/verif.list 2>/dev/null; then
    if grep -q "coolify-envs.json" /tmp/verif.list \
      && grep -q "INVENTAIRE.json" /tmp/verif.list \
      && [ "$(grep -c 'coolify/' /tmp/verif.list)" -ge 5 ]; then
      DRILL_STATUS="passed"; DRILL_REASON=""
      echo "✅ Relecture OK : $(wc -l < /tmp/verif.list) entrées déchiffrées depuis R2"
    else
      DRILL_REASON="contenu_incomplet"
    fi
  else
    DRILL_REASON="dechiffrement_impossible"
  fi
else
  DRILL_REASON="retelechargement_impossible"
fi
rm -f /tmp/verif.enc /tmp/verif.list
DRILL_DUR=$(( $(date +%s) - DRILL_START ))
report_restore_drill "${DRILL_STATUS}" "${RESOURCES}" "${DRILL_DUR}" "cron_vps" "${KEY}" "${DRILL_REASON}"
if [ "${DRILL_STATUS}" != "passed" ]; then
  echo "❌ L'archive envoyée ne se relit pas (${DRILL_REASON})"
  record_fail "relecture:${DRILL_REASON}"
  report_backup_run "failed" "$SIZE" null "r2" "$KEY" "relecture:${DRILL_REASON}"
  exit 1
fi

DUR=$(( $(date +%s) - START ))
record_success
report_backup_run "success" "$SIZE" "$DUR" "r2" "$KEY"
#DIGEST-SILENCED notify_telegram "OK secrets · $(du -h /tmp/${NAME}|cut -f1) · ${DUR}s" "🟢"
echo "✅ Secrets backup OK : $KEY ($(du -h /tmp/${NAME}|cut -f1), ${RESOURCES} ressources)"
INNER

docker run --rm \
  --network=coolify \
  -v "${WORK}/payload:/payload" \
  -v "${WORK}/inner.sh:/inner.sh:ro" \
  -v /var/lib/axion-backup:/state \
  -e BACKUP_TYPE="daily" \
  -e BACKUP_ENCRYPTION_PASSPHRASE="$(env_of BACKUP_ENCRYPTION_PASSPHRASE)" \
  -e R2_ACCOUNT_ID="$(env_of R2_ACCOUNT_ID)" \
  -e R2_ACCESS_KEY_ID="$(env_of R2_ACCESS_KEY_ID)" \
  -e R2_SECRET_ACCESS_KEY="$(env_of R2_SECRET_ACCESS_KEY)" \
  -e R2_BUCKET_NAME="$(env_of R2_BUCKET_NAME)" \
  -e R2_ENDPOINT="$(env_of R2_ENDPOINT)" \
  -e COOLIFY_API_TOKEN="$(env_of COOLIFY_API_TOKEN)" \
  -e COOLIFY_URL="$(env_of COOLIFY_URL)" \
  -e COOLIFY_APP_UUID="${APP_UUID}" \
  -e BACKUP_REPORT_URL="https://axion-ia.com" \
  -e BACKUP_INGEST_SECRET="$(env_of BACKUP_INGEST_SECRET)" \
  -e TELEGRAM_BOT_TOKEN="$(env_of TELEGRAM_BOT_TOKEN)" \
  -e TELEGRAM_CHAT_ID="$(env_of TELEGRAM_CHAT_ID)" \
  postgres:16-alpine \
  bash /inner.sh
