#!/usr/bin/env bash
# Backup secrets/config (export env Coolify) chiffré AES -> R2 (off-Hetzner). ADR 0032.
# Déchiffrable avec BACKUP_ENCRYPTION_PASSPHRASE (la passphrase à garder en coffre).
set -e
APP_CT=$(docker ps --filter "name=mqbmlz1bcwsdwi3t9fxsllqt" --format '{{.Names}}' | head -1)
docker run --rm \
  --network=coolify \
  -e BACKUP_TYPE="daily" \
  -e BACKUP_ENCRYPTION_PASSPHRASE="$(docker exec $APP_CT printenv BACKUP_ENCRYPTION_PASSPHRASE)" \
  -e R2_ACCOUNT_ID="$(docker exec $APP_CT printenv R2_ACCOUNT_ID)" \
  -e R2_ACCESS_KEY_ID="$(docker exec $APP_CT printenv R2_ACCESS_KEY_ID)" \
  -e R2_SECRET_ACCESS_KEY="$(docker exec $APP_CT printenv R2_SECRET_ACCESS_KEY)" \
  -e R2_BUCKET_NAME="$(docker exec $APP_CT printenv R2_BUCKET_NAME)" \
  -e R2_ENDPOINT="$(docker exec $APP_CT printenv R2_ENDPOINT)" \
  -e COOLIFY_API_TOKEN="$(docker exec $APP_CT printenv COOLIFY_API_TOKEN)" \
  -e COOLIFY_URL="$(docker exec $APP_CT printenv COOLIFY_URL)" \
  -e COOLIFY_APP_UUID="$(docker exec $APP_CT printenv COOLIFY_APP_UUID)" \
  -e BACKUP_REPORT_URL="https://axion-ia.com" \
  -e BACKUP_INGEST_SECRET="$(docker exec $APP_CT printenv BACKUP_INGEST_SECRET)" \
  -e TELEGRAM_BOT_TOKEN="$(docker exec $APP_CT printenv TELEGRAM_BOT_TOKEN)" \
  -e TELEGRAM_CHAT_ID="$(docker exec $APP_CT printenv TELEGRAM_CHAT_ID)" \
  postgres:16-alpine \
  bash -c '
    set -e
    apk add --no-cache aws-cli openssl curl >/dev/null
    export COMPONENT=secrets COMPONENT_LABEL=SECRETS HOSTNAME_TAG=vps
    export DATE_TAG=$(date -u +%Y%m%d-%H%M%S)
    curl -fsS https://raw.githubusercontent.com/will383842/axion-ia/main/scripts/backup-lib.sh -o /tmp/backup-lib.sh
    source /tmp/backup-lib.sh
    require_var BACKUP_ENCRYPTION_PASSPHRASE; require_var R2_ENDPOINT; require_var R2_BUCKET_NAME
    require_var COOLIFY_API_TOKEN; require_var COOLIFY_URL; require_var COOLIFY_APP_UUID
    START=$(date +%s); mkdir -p /tmp/payload
    curl -fsS -m 20 -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
      "${COOLIFY_URL}/api/v1/applications/${COOLIFY_APP_UUID}/envs" -o /tmp/payload/coolify-envs.json
    echo "backup secrets $(date -u)" > /tmp/payload/README.txt
    NAME="axion-ia-secrets-${DATE_TAG}-vps.tar.gz.enc"
    tar -C /tmp/payload -cf - . | gzip -9 | encrypt_aes > /tmp/${NAME}
    SIZE=$(stat -c%s /tmp/${NAME}); KEY="secrets/${NAME}"
    upload_r2 /tmp/${NAME} "$R2_BUCKET_NAME" "$KEY"
    prune_r2 "$R2_BUCKET_NAME" "secrets/" 12
    DUR=$(( $(date +%s) - START )); record_success
    report_backup_run "success" "$SIZE" "$DUR" "r2" "$KEY"
    #DIGEST-SILENCED notify_telegram "OK secrets · $(du -h /tmp/${NAME}|cut -f1) · ${DUR}s" "🟢"
    echo "✅ Secrets backup OK : $KEY ($(du -h /tmp/${NAME}|cut -f1))"
  '
