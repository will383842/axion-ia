#!/usr/bin/env bash
# Backup Plausible (Postgres config + ClickHouse events) chiffré -> R2 (off-Hetzner). ADR 0032.
# Conteneur éphémère avec socket Docker monté : auto-pull scripts/backup-{lib,plausible}.sh
# depuis GitHub main, puis `docker exec` dans les conteneurs Plausible pour dumper.
# Modèle : run-docuseal-backup.sh. Ajouté 2026-07-11.
set -e
TYPE="${1:-daily}"
APP_CT=$(docker ps --filter "name=mqbmlz1bcwsdwi3t9fxsllqt" --format '{{.Names}}' | head -1)
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
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
  -e PLAUSIBLE_PG_CONTAINER=plausible_db-vl41qwmhr6l26bmrjzet9h02 \
  -e PLAUSIBLE_PG_USER=plausible \
  -e PLAUSIBLE_PG_DB=plausible_db \
  -e PLAUSIBLE_CH_CONTAINER=plausible_events-vl41qwmhr6l26bmrjzet9h02 \
  -e PLAUSIBLE_CH_DB=plausible_events_db \
  postgres:16-alpine \
  bash -c '
    set -e
    apk add --no-cache aws-cli openssl curl docker-cli bash >/dev/null
    export HOSTNAME_TAG=vps
    mkdir -p /tmp/scripts
    curl -fsS https://raw.githubusercontent.com/will383842/axion-ia/main/scripts/backup-lib.sh      -o /tmp/scripts/backup-lib.sh
    curl -fsS https://raw.githubusercontent.com/will383842/axion-ia/main/scripts/backup-plausible.sh -o /tmp/scripts/backup-plausible.sh
    bash /tmp/scripts/backup-plausible.sh --type "$BACKUP_TYPE"
  '
