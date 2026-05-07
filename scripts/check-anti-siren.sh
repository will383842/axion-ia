#!/usr/bin/env bash
# AxionIA est OÜ estonienne — aucun SIREN/SIRET/RCS français autorisé.
# CLAUDE.md v6 §1 + §22.
set -e

PATTERN='\bsiren\b|\bsiret\b|\brcs\b'

RESULTS=$(grep -REni --color=never \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.json' --include='*.md' \
  --exclude='*.test.ts' --exclude='*.test.tsx' --exclude='*.spec.ts' --exclude='*.spec.tsx' \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=playwright-report --exclude-dir=coverage --exclude-dir=lhci --exclude-dir=test-results --exclude-dir=tests \
  -E "$PATTERN" src/ messages/ 2>/dev/null || true)

if [ -n "$RESULTS" ]; then
  echo "[anti-siren] FR-only legal terms found — AxionIA is OÜ estonienne"
  echo "$RESULTS"
  exit 1
fi

echo "[anti-siren] OK — 0 occurrence"
