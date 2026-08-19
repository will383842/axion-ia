#!/usr/bin/env bash
# Backup fichiers utilisateurs (CV + console-docs + reviews-media) chiffré -> R2. ADR 0032.
# tar crash-consistent des volumes montés :ro. Copie OFF-SITE (complète le snapshot Hetzner).
# Modèle : run-docuseal-backup.sh. Ajouté 2026-07-11.
set -e
TYPE="${1:-daily}"
APP_CT=$(docker ps --filter "name=mqbmlz1bcwsdwi3t9fxsllqt" --format '{{.Names}}' | head -1)
docker run --rm \
  --network=coolify \
  -e BACKUP_TYPE="$TYPE" \
  -e BACKUP_ENCRYPTION_PASSPHRASE="$(docker exec $APP_CT printenv BACKUP_ENCRYPTION_PASSPHRASE)" \
  -e R2_ACCOUNT_ID="$(docker exec $APP_CT printenv R2_ACCOUNT_ID)" \
  -e R2_ACCESS_KEY_ID="$(docker exec $APP_CT printenv R2_ACCESS_KEY_ID)" \
  -e R2_SECRET_ACCESS_KEY="$(docker exec $APP_CT printenv R2_SECRET_ACCESS_KEY)" \
  -e R2_BUCKET_NAME="$(docker exec $APP_CT printenv R2_BUCKET_NAME)" \
  -e R2_ENDPOINT="$(docker exec $APP_CT printenv R2_ENDPOINT)" \
  -e BACKUP_REPORT_URL="https://axion-ia.com" \
  -e BACKUP_INGEST_SECRET="$(docker exec $APP_CT printenv BACKUP_INGEST_SECRET)" \
  -e TELEGRAM_BOT_TOKEN="$(docker exec $APP_CT printenv TELEGRAM_BOT_TOKEN)" \
  -e TELEGRAM_CHAT_ID="$(docker exec $APP_CT printenv TELEGRAM_CHAT_ID)" \
  -v mqbmlz1bcwsdwi3t9fxsllqt-cv-storage:/data/cv:ro \
  -v mqbmlz1bcwsdwi3t9fxsllqt-console-docs:/data/console-docs:ro \
  -v /var/data/reviews-media:/data/reviews-media:ro \
  postgres:16-alpine \
  bash -c '
    set -e
    apk add --no-cache aws-cli openssl curl bash >/dev/null
    mkdir -p /tmp/scripts
    curl -fsS https://raw.githubusercontent.com/will383842/axion-ia/main/scripts/backup-lib.sh -o /tmp/scripts/backup-lib.sh
    export COMPONENT=files_utilisateurs COMPONENT_LABEL=FILES HOSTNAME_TAG=vps
    export DATE_TAG=$(date -u +%Y%m%d-%H%M%S)
    source /tmp/scripts/backup-lib.sh
    require_var BACKUP_ENCRYPTION_PASSPHRASE; require_var R2_ENDPOINT; require_var R2_BUCKET_NAME
    START=$(date +%s)
    NAME="axion-ia-files-${BACKUP_TYPE}-${DATE_TAG}-vps.tar.gz.enc"
    tar -C /data -cf - . | gzip -9 | encrypt_aes > /tmp/${NAME}
    SIZE=$(stat -c%s /tmp/${NAME}); KEY="files/${BACKUP_TYPE}/${NAME}"
    upload_r2 /tmp/${NAME} "$R2_BUCKET_NAME" "$KEY"
    prune_r2 "$R2_BUCKET_NAME" "files/${BACKUP_TYPE}/" 14
    DUR=$(( $(date +%s) - START )); record_success
    report_backup_run "success" "$SIZE" "$DUR" "r2" "$KEY"
    #DIGEST-SILENCED notify_telegram "OK ${BACKUP_TYPE} · $(du -h /tmp/${NAME}|cut -f1) · ${DUR}s" "🟢"
    echo "✅ Files backup OK : $KEY ($(du -h /tmp/${NAME}|cut -f1))"
  '
