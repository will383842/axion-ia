#!/usr/bin/env bash
# Couleurs hex hardcodées interdites hors globals.css et tokens.
# Tout passe par CSS variables / Tailwind tokens — Design.md.
set -e

PATTERN='#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b'

RESULTS=$(grep -REn --color=never \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=playwright-report --exclude-dir=coverage --exclude-dir=lhci --exclude-dir=test-results \
  -E "$PATTERN" src/components src/app 2>/dev/null | grep -v '// hex-ok:' || true)

# CSS files allowed (globals.css holds tokens).
if [ -n "$RESULTS" ]; then
  echo "[anti-hex] hardcoded hex color(s) found — use Tailwind tokens / CSS variables"
  echo "$RESULTS"
  exit 1
fi

echo "[anti-hex] OK — 0 hardcoded hex"
