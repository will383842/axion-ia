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
  echo ""
  echo "[anti-hex] Si la chaîne signalée N'EST PAS une couleur — un numéro de PR"
  echo "[anti-hex] écrit « #980 » dans un commentaire, par exemple — reformulez"
  echo "[anti-hex] (« la PR 980 ») ou marquez la ligne avec  // hex-ok:"
  echo "[anti-hex]"
  echo "[anti-hex] ⚠️ NE RÉTRÉCISSEZ PAS LE MOTIF pour absoudre les suites de"
  echo "[anti-hex] chiffres : #000, #333, #666, #999 sont des couleurs hex à trois"
  echo "[anti-hex] chiffres ENTIÈREMENT DÉCIMALES, et ce sont justement les gris"
  echo "[anti-hex] qu'on écrit en dur pour contourner les jetons. La règle qui"
  echo "[anti-hex] absout « #980 » absout « #999 » : un trou permanent sur la"
  echo "[anti-hex] famille la plus probable, contre un faux positif par an."
  echo "[anti-hex] (La sortie propre, si ce script redevient bruyant, est de lire"
  echo "[anti-hex] la POSITION syntaxique — commentaire vs valeur de style — et non"
  echo "[anti-hex] la chaîne : un même token y est discriminé sans exemption.)"
  exit 1
fi

echo "[anti-hex] OK — 0 hardcoded hex"
