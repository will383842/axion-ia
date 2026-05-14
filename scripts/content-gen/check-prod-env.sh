#!/usr/bin/env bash
#
# Pass B P0-3 follow-up — Vérification env vars content-gen en prod Coolify.
#
# Liste les vars REQUISES pour le content-gen V1 et indique lesquelles sont
# présentes en prod. N'expose JAMAIS les valeurs (juste le nom + un check
# présent/absent).
#
# Prérequis :
#   - `source .secrets/api-tokens.env` (cf. memory axionia_infra_tokens_pointer)
#     pour avoir COOLIFY_URL + COOLIFY_API_TOKEN + COOLIFY_APP_UUID.
#
# Usage : `bash scripts/content-gen/check-prod-env.sh`

set -euo pipefail

# shellcheck disable=SC2153
if [ -z "${COOLIFY_API_TOKEN:-}" ] || [ -z "${COOLIFY_URL:-}" ] || [ -z "${COOLIFY_APP_UUID:-}" ]; then
  echo "❌ Variables Coolify absentes. Charge .secrets/api-tokens.env d'abord :"
  echo "   set -a && source .secrets/api-tokens.env && set +a"
  exit 1
fi

REQUIRED_VARS=(
  "OPENAI_API_KEY"
  "ANTHROPIC_API_KEY"
  "PERPLEXITY_API_KEY"
  "UNSPLASH_ACCESS_KEY"
  "VOYAGE_API_KEY"
  "KB_INGEST_SECRET"
  "KB_AUTO_PUBLISH"
  "INDEXNOW_KEY"
)

OPTIONAL_VARS=(
  "OPENAI_ORG_ID"
  "UNSPLASH_SECRET_KEY"
  "GOOGLE_INDEXING_API_ENABLED"
  "GOOGLE_INDEXING_SA_JSON"
)

echo "🔍 Audit env vars content-gen en prod Coolify"
echo "   App UUID : $COOLIFY_APP_UUID"
echo ""

# Récupère la liste des env vars (noms uniquement, pas les valeurs).
RESPONSE=$(curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID/envs")

if [ -z "$RESPONSE" ] || echo "$RESPONSE" | grep -q "Unauthorized"; then
  echo "❌ API Coolify : pas de réponse ou non autorisée. Vérifie COOLIFY_API_TOKEN."
  exit 2
fi

# Extrait juste les `key` (noms) — pas les valeurs.
PROD_VARS=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for e in data:
        k = e.get('key', '')
        if k:
            print(k)
except Exception as e:
    print(f'PARSE_ERROR: {e}', file=sys.stderr)
    sys.exit(3)
")

echo "📋 Vars REQUISES (V1 content-gen — sans elles les workers no-op silencieux) :"
echo ""
MISSING_REQ=0
for var in "${REQUIRED_VARS[@]}"; do
  if echo "$PROD_VARS" | grep -q "^${var}$"; then
    echo "  ✅ $var"
  else
    echo "  ❌ $var  ← MANQUANT en prod"
    MISSING_REQ=$((MISSING_REQ + 1))
  fi
done

echo ""
echo "📋 Vars OPTIONNELLES (features V2 ou advanced) :"
echo ""
for var in "${OPTIONAL_VARS[@]}"; do
  if echo "$PROD_VARS" | grep -q "^${var}$"; then
    echo "  ✅ $var"
  else
    echo "  ⚠️  $var  ← absent (OK V1, requis V2 selon use case)"
  fi
done

echo ""
if [ "$MISSING_REQ" -eq 0 ]; then
  echo "🟢 OK — toutes les vars REQUISES sont présentes en prod."
  exit 0
else
  echo "🔴 $MISSING_REQ var(s) REQUISES manquante(s) — ajouter via Coolify UI ou API"
  echo "   avant le cutover content-gen prod."
  echo ""
  echo "   Ajout via UI : Coolify → Applications → axionia-web → Environment Variables → Add"
  echo "   Ajout via API : POST $COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID/envs"
  exit 2
fi
