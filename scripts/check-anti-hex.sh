#!/usr/bin/env bash
# Couleurs hex hardcodées interdites hors globals.css, tokens et page de démo design.
# Tout passe par CSS variables / Tailwind tokens — Design.md.
set -e

PATTERN='#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b'

RESULTS=$(grep -REn --color=never \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' \
  --exclude='globals.css' \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=playwright-report --exclude-dir=coverage --exclude-dir=lhci --exclude-dir=test-results --exclude-dir=design \
  -E "$PATTERN" src/components src/app 2>/dev/null | grep -v '// hex-ok:' || true)

if [ -n "$RESULTS" ]; then
  echo "[anti-hex] hardcoded hex color(s) found — use Tailwind tokens / CSS variables"
  echo "$RESULTS"
  exit 1
fi

echo "[anti-hex] OK — 0 hardcoded hex"
