#!/usr/bin/env bash
# Miroir des PIÈCES LÉGALES vers le compartiment R2 VERROUILLÉ. ADR 0032, constat D66-01.
#
# 🔴 POURQUOI CE WRAPPER N'EXISTAIT PAS, ET CE QUE ÇA CACHAIT.
# `scripts/backup-documents-r2.sh` vit dans le dépôt depuis le 2026-08-19, mais
# RIEN sur le VPS ne l'appelait : ni wrapper, ni ligne de cron. Le bucket qui
# porte les conventions, les attestations, les factures et les images de
# signature n'était donc sauvegardé par personne — alors que le dépôt contenait
# le script qui le fait, et une garde qui vérifie que ses préfixes sont à jour.
# Un script présent, gardé, documenté, et jamais exécuté : c'est plus trompeur
# qu'un script absent.
#
# ⚠️ LE COMPARTIMENT DE DESTINATION EST VERROUILLÉ (`retention-1-an`, posé le
# 2026-09-20). Mesuré le jour même sur le compartiment réel :
#
#     1er envoi            → OK
#     2e envoi, même clé   → ObjectLockedByBucketPolicy
#     suppression          → ObjectLockedByBucketPolicy
#
# Un `aws s3 sync` aurait donc échoué dès la première pièce RÉGÉNÉRÉE. C'est
# pour ça que `backup-documents-r2.sh` dépose une clé datée à côté au lieu de
# remplacer. Ne pas revenir à un `sync` ici.
#
# Modèle : run-files-backup.sh. Ajouté le 2026-09-20.
#
# Usage :
#   /opt/axion-ia/run-documents-mirror.sh            # quotidien
#   /opt/axion-ia/run-documents-mirror.sh monthly    # passage mensuel
#   REF=ma-branche /opt/axion-ia/run-documents-mirror.sh   # tester avant fusion
set -e
TYPE="${1:-daily}"

# Branche du dépôt d'où viennent les scripts. `main` en exploitation ; une autre
# valeur sert à éprouver une correction AVANT de la fusionner — le miroir écrit
# dans un compartiment où rien ne s'efface, mieux vaut l'essayer sciemment.
REF="${REF:-main}"

# 📌 Le nom du compartiment N'EST PAS UN SECRET, et l'application ne le lit
# jamais : seul ce miroir s'en sert. Il est donc posé ici, et pas dans les
# variables d'environnement de Coolify — une dépendance de moins entre un script
# d'exploitation et la configuration de l'app.
R2_BUCKET_IMMUTABLE="${R2_BUCKET_IMMUTABLE:-axion-ia-backups-immutable}"

APP_CT=$(docker ps --filter "name=mqbmlz1bcwsdwi3t9fxsllqt" --format '{{.Names}}' | head -1)
docker run --rm \
  -v /var/lib/axion-backup:/state \
  -e FAIL_COUNT_DIR=/state \
  --network=coolify \
  -e BACKUP_TYPE="$TYPE" \
  -e REF="$REF" \
  -e R2_ACCOUNT_ID="$(docker exec $APP_CT printenv R2_ACCOUNT_ID)" \
  -e R2_ACCESS_KEY_ID="$(docker exec $APP_CT printenv R2_ACCESS_KEY_ID)" \
  -e R2_SECRET_ACCESS_KEY="$(docker exec $APP_CT printenv R2_SECRET_ACCESS_KEY)" \
  -e R2_BUCKET_NAME="$(docker exec $APP_CT printenv R2_BUCKET_NAME)" \
  -e R2_BUCKET_IMMUTABLE="$R2_BUCKET_IMMUTABLE" \
  -e R2_ENDPOINT="$(docker exec $APP_CT printenv R2_ENDPOINT)" \
  -e BACKUP_REPORT_URL="https://axion-ia.com" \
  -e BACKUP_INGEST_SECRET="$(docker exec $APP_CT printenv BACKUP_INGEST_SECRET)" \
  -e TELEGRAM_BOT_TOKEN="$(docker exec $APP_CT printenv TELEGRAM_BOT_TOKEN)" \
  -e TELEGRAM_CHAT_ID="$(docker exec $APP_CT printenv TELEGRAM_CHAT_ID)" \
  postgres:16-alpine \
  bash -c '
    set -e
    apk add --no-cache aws-cli curl bash >/dev/null
    mkdir -p /tmp/scripts
    BASE="https://raw.githubusercontent.com/will383842/axion-ia/${REF}/scripts"
    # Les deux fichiers ensemble : le script source son voisin par `dirname $0`.
    curl -fsS "${BASE}/backup-lib.sh"            -o /tmp/scripts/backup-lib.sh
    curl -fsS "${BASE}/backup-documents-r2.sh"   -o /tmp/scripts/backup-documents-r2.sh
    export HOSTNAME_TAG=vps
    bash /tmp/scripts/backup-documents-r2.sh --type "$BACKUP_TYPE"
  '
