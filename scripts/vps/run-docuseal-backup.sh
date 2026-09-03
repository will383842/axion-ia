#!/usr/bin/env bash
# Backup Docuseal (volume entier : SQLite + pièces) chiffré -> R2 (off-Hetzner). ADR 0032.
# tar crash-consistent du volume (SQLite récupère d'un snapshot). Volume monté :ro.
set -e
TYPE="${1:-monthly}"
APP_CT=$(docker ps --filter "name=mqbmlz1bcwsdwi3t9fxsllqt" --format '{{.Names}}' | head -1)
docker run --rm \
  -v /var/lib/axion-backup:/state \
  -e FAIL_COUNT_DIR=/state \
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
  -v sldtf6oky71nrzx74pwactrq-docuseal-data:/docuseal-data:ro \
  postgres:16-alpine \
  bash -c '
    set -e
    apk add --no-cache aws-cli openssl curl >/dev/null
    export COMPONENT=docuseal COMPONENT_LABEL=DOCUSEAL HOSTNAME_TAG=vps
    export DATE_TAG=$(date -u +%Y%m%d-%H%M%S)
    curl -fsS https://raw.githubusercontent.com/will383842/axion-ia/main/scripts/backup-lib.sh -o /tmp/backup-lib.sh
    source /tmp/backup-lib.sh
    require_var BACKUP_ENCRYPTION_PASSPHRASE; require_var R2_ENDPOINT; require_var R2_BUCKET_NAME
    START=$(date +%s)
    NAME="axion-ia-docuseal-${BACKUP_TYPE}-${DATE_TAG}-vps.tar.gz.enc"
    tar -C /docuseal-data -cf - . | gzip -9 | encrypt_aes > /tmp/${NAME}
    SIZE=$(stat -c%s /tmp/${NAME}); KEY="docuseal/${BACKUP_TYPE}/${NAME}"
    upload_r2 /tmp/${NAME} "$R2_BUCKET_NAME" "$KEY"
    prune_r2 "$R2_BUCKET_NAME" "docuseal/${BACKUP_TYPE}/" 24
    DUR=$(( $(date +%s) - START )); record_success
    report_backup_run "success" "$SIZE" "$DUR" "r2" "$KEY"
    #DIGEST-SILENCED notify_telegram "OK ${BACKUP_TYPE} · $(du -h /tmp/${NAME}|cut -f1) · ${DUR}s" "🟢"
    echo "✅ Docuseal backup OK : $KEY ($(du -h /tmp/${NAME}|cut -f1))"
  '
