#!/usr/bin/env bash
# Axion-IA est une société française — SIREN/SIRET/RCS sont attendus.
# Ce hook vérifie qu'aucun vrai numéro SIREN n'est hardcodé hors URL
# avant l'immatriculation officielle. Utiliser le placeholder [SIREN à compléter].
# Un SIREN réel = mot-clé "SIREN" ou "SIRET" suivi de 9 ou 14 chiffres.
set -e

# Cherche "SIREN 123456789" ou "SIRET 12345678901234" (hors URL, hors placeholder)
PATTERN='(SIREN|SIRET)\s+[0-9]{9,14}'

RESULTS=$(grep -REn --color=never \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' \
  --exclude='*.test.ts' --exclude='*.test.tsx' --exclude='*.spec.ts' --exclude='*.spec.tsx' \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=playwright-report \
  --exclude-dir=coverage --exclude-dir=lhci --exclude-dir=test-results \
  -E "$PATTERN" src/ 2>/dev/null || true)

if [ -n "$RESULTS" ]; then
  echo "[anti-siren] Vrai SIREN/SIRET hardcode detecte — utiliser placeholder [SIREN a completer]"
  echo "$RESULTS"
  exit 1
fi

echo "[anti-siren] OK — 0 SIREN hardcode"
