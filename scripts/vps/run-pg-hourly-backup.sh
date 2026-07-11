#!/usr/bin/env bash
# Backup Postgres HORAIRE -> R2 (préfixe postgres/hourly/, rétention 24).
# Middle-path RPO 24h -> ~1h SANS toucher la config Postgres (0 risque WAL).
# Conteneur postgres:16-alpine éphémère sur réseau coolify, env injecté depuis
# l'app, pg_dump via DATABASE_URL, chiffrement AES via backup-lib.sh (auto-pull).
# Composant dashboard = "postgres" (rafraîchit le RPO du composant Postgres).
# Ajouté 2026-07-11. Restaurable à l'identique du dump daily (même passphrase).
set -e
APP_CT=$(docker ps --filter "name=mqbmlz1bcwsdwi3t9fxsllqt" --format '{{.Names}}' | head -1)
docker run --rm \
  --network=coolify \
  -e DATABASE_URL="$(docker exec $APP_CT printenv DATABASE_URL)" \
  -e DIRECT_URL="$(docker exec $APP_CT printenv DIRECT_URL 2>/dev/null)" \
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
  postgres:16-alpine \
  bash -c '
    set -e
    apk add --no-cache aws-cli openssl curl bash >/dev/null
    mkdir -p /tmp/scripts
    curl -fsS https://raw.githubusercontent.com/will383842/axion-ia/main/scripts/backup-lib.sh -o /tmp/scripts/backup-lib.sh
    export COMPONENT=postgres COMPONENT_LABEL=POSTGRES-HOURLY HOSTNAME_TAG=vps BACKUP_TYPE=hourly
    export DATE_TAG=$(date -u +%Y%m%d-%H%M%S)
    source /tmp/scripts/backup-lib.sh
    require_var DATABASE_URL; require_var BACKUP_ENCRYPTION_PASSPHRASE
    require_var R2_ENDPOINT; require_var R2_BUCKET_NAME
    PG_URL="${DIRECT_URL:-$DATABASE_URL}"; PG_URL_CLEAN="${PG_URL%%\?*}"
    START=$(date +%s)
    NAME="axion-ia-pg-hourly-${DATE_TAG}-vps.dump.gz.enc"
    pg_dump --format=custom --no-owner --no-acl "$PG_URL_CLEAN" | gzip --best | encrypt_aes > /tmp/${NAME}
    SIZE=$(stat -c%s /tmp/${NAME}); KEY="postgres/hourly/${NAME}"
    upload_r2 /tmp/${NAME} "$R2_BUCKET_NAME" "$KEY"
    prune_r2 "$R2_BUCKET_NAME" "postgres/hourly/" 24
    DUR=$(( $(date +%s) - START )); record_success
    report_backup_run "success" "$SIZE" "$DUR" "r2" "$KEY"
    #DIGEST-SILENCED notify_telegram "OK hourly · $(du -h /tmp/${NAME}|cut -f1) · ${DUR}s" "🟢"
    echo "✅ PG hourly OK : $KEY ($(du -h /tmp/${NAME}|cut -f1))"
  '
