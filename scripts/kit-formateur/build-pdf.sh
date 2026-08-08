#!/usr/bin/env bash
# Convertit chaque _KIT/<slug>/kit-formateur.html en PDF A4 prêt à imprimer.
#
# Chrome en mode headless est le seul convertisseur utilisé : c'est le moteur
# qui rend déjà la page à l'écran, donc le PDF ne peut pas diverger de ce que
# la relecture a validé. `--no-pdf-header-footer` retire l'URL et la date que
# Chrome imprime par défaut en marge — elles n'ont rien à faire sur une pièce
# distribuée en salle.
#
# 🔴 Le chemin passé à `file:///` doit être une chemin WINDOWS (`C:/Users/…`).
# Sous Git Bash, `pwd` rend `/c/Users/…` : Chrome ne le résout pas, imprime une
# page d'erreur, et sort avec le code 0. Le PDF fait alors UNE page et le script
# annonce un succès. D'où la vérification finale, qui compte les pages — une
# conversion réussie en produit toujours plus d'une.
#
# Usage : bash scripts/kit-formateur/build-pdf.sh [slug…]
set -euo pipefail

CHROME=""
for c in \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  "$(command -v google-chrome || true)" \
  "$(command -v chromium || true)"; do
  if [ -n "$c" ] && [ -f "$c" ]; then CHROME="$c"; break; fi
done

if [ -z "$CHROME" ]; then
  echo "⛔ Aucun Chrome ni Edge trouvé — impossible de produire les PDF." >&2
  exit 1
fi

cd "$(dirname "$0")/../.."
# Chemin natif Windows si l'on est sous Git Bash, chemin POSIX sinon.
RACINE="$(pwd -W 2>/dev/null || pwd)"

if [ "$#" -gt 0 ]; then
  SLUGS=("$@")
else
  mapfile -t SLUGS < <(find _KIT -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort)
fi

produits=()
for slug in "${SLUGS[@]}"; do
  [ -f "_KIT/$slug/kit-formateur.html" ] || { echo "  ⚠️  $slug — pas de HTML, ignoré"; continue; }
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$RACINE/_KIT/$slug/kit-formateur.pdf" \
    "file:///$RACINE/_KIT/$slug/kit-formateur.html" >/dev/null 2>&1
  produits+=("$slug")
done

# ── La garde : un PDF d'une seule page est une page d'erreur, pas un kit ──────
python - "${produits[@]}" <<'PY'
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    print(f"{len(sys.argv) - 1} PDF produits — page count NON vérifié (PyMuPDF absent).")
    sys.exit(0)

suspects = []
for slug in sys.argv[1:]:
    doc = fitz.open(f"_KIT/{slug}/kit-formateur.pdf")
    if doc.page_count <= 1:
        suspects.append((slug, doc.page_count))
    doc.close()

if suspects:
    print("⛔ Conversion ratée — ces PDF ne portent qu'une page :", file=sys.stderr)
    for slug, n in suspects:
        print(f"   - {slug} ({n} page)", file=sys.stderr)
    sys.exit(1)

print(f"{len(sys.argv) - 1} PDF produits, tous à plus d'une page.")
PY
