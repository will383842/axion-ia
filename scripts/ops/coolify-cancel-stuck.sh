#!/usr/bin/env bash
# Cancel tous les déploiements Coolify `in_progress` ou `queued`.
# Phase 7.5 / 8.bis — runbook deploy recovery 2026-05-17.
#
# Usage :
#   COOLIFY_API_TOKEN=<token> COOLIFY_URL=https://your-coolify scripts/ops/coolify-cancel-stuck.sh
#
# Équivalent du workflow GH Actions `coolify-diagnose.yml action=cancel-stuck`.
# Pour usage local. Le workflow GHA est préféré en autopilote
# (token jamais exposé en clair localement).
set -euo pipefail

: "${COOLIFY_API_TOKEN:?required — set via env or 1Password/Bitwarden CLI}"
: "${COOLIFY_URL:?required}"

AUTH="Authorization: Bearer ${COOLIFY_API_TOKEN}"

echo "→ Fetching deployments from ${COOLIFY_URL}/api/v1/deployments"
STUCK=$(curl -fsSL -m 15 -H "$AUTH" "${COOLIFY_URL}/api/v1/deployments" \
  | jq -r '.[] | select(.status == "in_progress" or .status == "queued") | (.deployment_uuid // .uuid)')

if [ -z "${STUCK}" ]; then
  echo "✓ No stuck deployments — queue is clean."
  exit 0
fi

COUNT=$(echo "${STUCK}" | wc -l)
echo "⚠ Found ${COUNT} stuck deployment(s)"

for uuid in ${STUCK}; do
  echo "→ Cancelling ${uuid}"
  RESP=$(curl -sS -m 30 -X GET -H "$AUTH" \
    "${COOLIFY_URL}/api/v1/deployments/${uuid}/cancel" 2>&1 || echo "(no response body)")
  echo "  Response: ${RESP}"
done

sleep 5
echo ""
echo "==== POST-CANCEL STATE ===="
curl -fsSL -m 15 -H "$AUTH" "${COOLIFY_URL}/api/v1/deployments" \
  | jq '[.[0:10] | .[] | {uuid: (.deployment_uuid // .uuid), status, created_at}]'
