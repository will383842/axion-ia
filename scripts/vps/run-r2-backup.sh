#!/usr/bin/env bash
# Backup Postgres -> R2 (wrapper VPS). Lance un postgres:16-alpine éphémère sur
# le réseau coolify, injecte l'env depuis le container app, et exécute les
# scripts backup tirés de GitHub main (auto-pull). ADR 0032 : reporting dashboard.
set -e
APP_CT=$(docker ps --filter "name=mqbmlz1bcwsdwi3t9fxsllqt" --format '{{.Names}}' | head -1)
docker run --rm \
  --network=coolify \
  -e DATABASE_URL="$(docker exec $APP_CT printenv DATABASE_URL)" \
  -e BACKUP_ENCRYPTION_PASSPHRASE="$(docker exec $APP_CT printenv BACKUP_ENCRYPTION_PASSPHRASE)" \
  -e R2_ACCOUNT_ID="$(docker exec $APP_CT printenv R2_ACCOUNT_ID)" \
  -e R2_ACCESS_KEY_ID="$(docker exec $APP_CT printenv R2_ACCESS_KEY_ID)" \
  -e R2_SECRET_ACCESS_KEY="$(docker exec $APP_CT printenv R2_SECRET_ACCESS_KEY)" \
  -e R2_BUCKET_NAME="$(docker exec $APP_CT printenv R2_BUCKET_NAME)" \
  -e R2_ENDPOINT="$(docker exec $APP_CT printenv R2_ENDPOINT)" \
  -e BACKUP_REPORT_URL="https://axion-ia.com" \
  -e BACKUP_INGEST_SECRET="$(docker exec $APP_CT printenv BACKUP_INGEST_SECRET)" \
  -v /opt/axion-ia:/work -w /work \
  postgres:16-alpine \
  sh -c "apk add --no-cache aws-cli openssl curl >/dev/null && \
    wget -q https://raw.githubusercontent.com/will383842/axion-ia/main/scripts/backup-lib.sh -O /tmp/backup-lib.sh && \
    wget -q https://raw.githubusercontent.com/will383842/axion-ia/main/scripts/backup-postgres-r2.sh -O /tmp/backup.sh && \
    chmod +x /tmp/backup.sh && /tmp/backup.sh ${1:-daily}"
