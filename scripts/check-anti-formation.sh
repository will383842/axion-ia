#!/usr/bin/env bash
# Banned-word grep — CLAUDE.md v6 §2.
# 'formation IA' as a SEO keyword is allowed in messages/*.json values via the
# whitelist below; everywhere else (code, comments, copy) the word must not appear.
set -e

PATTERN='formation|formateur|former vos|formé(e)?\b'

# Skip allowed paths and the whitelist marker.
RESULTS=$(grep -REn --color=never \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.css' --include='*.json' --include='*.md' \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=playwright-report --exclude-dir=coverage --exclude-dir=lhci --exclude-dir=test-results \
  -E "$PATTERN" src/ messages/ scripts/ 2>/dev/null | grep -v 'I18N_KEYWORD_OK' || true)

if [ -n "$RESULTS" ]; then
  echo "[anti-formation] banned word(s) found — see CLAUDE.md v6 §2"
  echo "$RESULTS"
  exit 1
fi

echo "[anti-formation] OK — 0 banned occurrence"
