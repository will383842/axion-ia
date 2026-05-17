#!/usr/bin/env bash
# Health dump SSH Hetzner CPX42 + Coolify.
# Phase 7.5 / 8.bis — runbook deploy recovery 2026-05-17.
#
# Prérequis : accès SSH root@178.105.55.15 (clé ~/.ssh/id_rsa configurée).
#
# Usage :
#   scripts/ops/hetzner-coolify-health.sh
#   scripts/ops/hetzner-coolify-health.sh > /tmp/hetzner-snapshot.txt
set -euo pipefail

HETZNER_IP="${HETZNER_IP:-178.105.55.15}"
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new"

echo "=== Probing SSH to ${HETZNER_IP} ==="
if ! ssh ${SSH_OPTS} root@"${HETZNER_IP}" 'echo SSH_OK' >/dev/null 2>&1; then
  echo "❌ SSH unreachable. Vérifier la clé locale + firewall Hetzner."
  exit 1
fi
echo "✓ SSH OK"

ssh ${SSH_OPTS} root@"${HETZNER_IP}" 'bash -s' <<'REMOTE'
set -euo pipefail
echo "=== HOSTNAME ==="     ; hostname -f
echo "=== UPTIME ==="       ; uptime
echo "=== DISK ==="         ; df -h /
echo "=== RAM ==="          ; free -h
echo "=== LOAD ==="         ; cat /proc/loadavg
echo "=== DOCKER PS ==="    ; docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.RunningFor}}' | head -40
echo "=== DOCKER STATS (snapshot) ==="
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' | head -15
echo "=== DOCKER DF ==="    ; docker system df
echo "=== COOLIFY LOGS (last 100) ==="
COOLIFY_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i '^coolify$' | head -1 || echo "")
if [ -n "${COOLIFY_CONTAINER}" ]; then
  docker logs --tail 100 "${COOLIFY_CONTAINER}" 2>&1 | tail -100
else
  echo "(Coolify container not found by exact name 'coolify')"
fi
echo "=== DEPLOYMENT QUEUE (Coolify DB) ==="
COOLIFY_DB=$(docker ps --format '{{.Names}}' | grep -iE 'coolify.*db|postgres.*coolify' | head -1 || echo "")
if [ -n "${COOLIFY_DB}" ]; then
  docker exec "${COOLIFY_DB}" psql -U coolify -c "SELECT id, status, created_at FROM application_deployment_queues ORDER BY created_at DESC LIMIT 10;" 2>/dev/null \
    || echo "(query failed — vérifier nom user DB)"
else
  echo "(Coolify DB container not found)"
fi
echo "=== NET → GHCR ==="
curl -sIL -m 5 https://ghcr.io/v2/ 2>&1 | head -5 || echo "(GHCR unreachable from host)"
echo "=== DONE ==="
REMOTE
