#!/usr/bin/env bash
# Le coffre Bitwarden contient-il de quoi rouvrir les sauvegardes ?
#
# ## La question, et pourquoi elle ne se pose qu'ici
#
# `BACKUP_ENCRYPTION_PASSPHRASE` chiffre TOUTES les sauvegardes R2. Il est le seul
# secret qui ne peut pas être DANS la sauvegarde — il la chiffre. Il ne vit donc
# qu'à trois endroits : les variables Coolify, les secrets GitHub Actions (en
# écriture seule, illisibles par un humain), et le coffre. Le jour où le VPS et
# Coolify disparaissent ensemble, la copie du coffre est la seule qui reste.
#
# ## Ce que ce script fait, et qui vaut mieux qu'une comparaison d'empreintes
#
# Il ne compare rien à une référence : **il essaie d'ouvrir la vraie archive**
# avec chaque valeur du coffre. C'est la question elle-même, sans intermédiaire.
# Une empreinte identique à celle de Coolify prouverait seulement que les deux
# copies concordent — pas qu'elles déchiffrent quoi que ce soit.
#
# Il répond donc par : quelle entrée, quel champ. Ou : aucun.
#
# ## Ce qu'il n'affiche jamais
#
# Aucune valeur du coffre, aucun secret déchiffré. Uniquement des noms d'entrées,
# des noms de champs et des longueurs. Le contenu du coffre transite en mémoire,
# n'est jamais écrit sur le disque, et le dossier de travail est détruit à la
# sortie — y compris sur erreur ou interruption.
#
# ## Usage
#
#   bash scripts/verifier-kit-bitwarden.sh
#
# Prérequis : la CLI Bitwarden (`winget install Bitwarden.CLI`). Les accès R2
# sont lus dans `../.secrets/api-tokens.env` (hors dépôt).
set -uo pipefail

# ─── Localiser la CLI (le PATH n'est pas rafraîchi juste après l'install) ─────
BW="${BW_BIN:-}"
if [ -z "${BW}" ]; then
  BW=$(command -v bw 2>/dev/null || true)
fi
if [ -z "${BW}" ]; then
  CANDIDAT=$(find "${LOCALAPPDATA:-/c/Users/$USER/AppData/Local}/Microsoft/WinGet/Packages" \
    -name 'bw.exe' 2>/dev/null | head -1)
  [ -n "${CANDIDAT}" ] && BW="${CANDIDAT}"
fi
if [ -z "${BW}" ]; then
  echo "❌ CLI Bitwarden introuvable. Installe-la : winget install Bitwarden.CLI"
  exit 1
fi

# ─── Accès R2 (jamais affichés) ──────────────────────────────────────────────
CREDS="${1:-$(dirname "$0")/../../.secrets/api-tokens.env}"
charger() {
  local nom="$1" v
  if [ -n "${!nom:-}" ]; then return 0; fi
  v=$(grep -E "^${nom}=" "${CREDS}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')
  if [ -z "${v}" ]; then
    echo "❌ ${nom} introuvable (ni environnement, ni ${CREDS})"; exit 1
  fi
  printf -v "${nom}" '%s' "${v}"; export "${nom?}"
}
for v in R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT R2_BUCKET_NAME; do charger "$v"; done

WORK=$(mktemp -d); chmod 700 "${WORK}"
trap 'rm -rf "${WORK}"' EXIT INT TERM

# ─── 1. État du coffre ───────────────────────────────────────────────────────
echo "── 1/4 · état du coffre ────────────────────────────────────────────────"
ETAT=$("${BW}" status 2>/dev/null | python -c "import json,sys; print(json.load(sys.stdin).get('status','inconnu'))" 2>/dev/null || echo "inconnu")
echo "   ${ETAT}"

# Connexion et déverrouillage sont faits ICI plutôt que renvoyés à l'opérateur :
# une étape séparée de plus, c'est une occasion de plus de se tromper, et le
# `bw login` isolé n'apporte rien qu'on ne puisse enchaîner.
SESSION=""
case "${ETAT}" in
  unauthenticated | inconnu)
    echo ""
    echo "   Coffre non connecté sur ce poste. Connexion (une seule fois) :"
    echo "   adresse e-mail, puis mot de passe maître, puis code à deux facteurs"
    echo "   si tu en as un. Rien ne s'affiche pendant la frappe du mot de passe."
    echo ""
    SESSION=$("${BW}" login --raw)
    ;;
  locked)
    echo ""
    echo "   Coffre verrouillé. Mot de passe maître (frappe masquée) :"
    SESSION=$("${BW}" unlock --raw)
    ;;
  unlocked)
    SESSION="${BW_SESSION:-}"
    if [ -z "${SESSION}" ]; then
      echo ""
      echo "   Coffre déverrouillé mais session absente. Mot de passe maître :"
      SESSION=$("${BW}" unlock --raw)
    fi
    ;;
esac

if [ -z "${SESSION:-}" ]; then
  echo ""
  echo "❌ Coffre non ouvert. Rien n'a été vérifié — relance et réessaie."
  exit 1
fi
export BW_SESSION="${SESSION}"

# ─── 2. L'archive de référence ───────────────────────────────────────────────
echo ""
echo "── 2/4 · dernière sauvegarde de secrets sur R2 ─────────────────────────"
r2() {
  curl -sS --fail-with-body --aws-sigv4 "aws:amz:auto:s3" \
    --user "${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}" \
    -o "$2" "${R2_ENDPOINT%/}/${R2_BUCKET_NAME}$1"
}
if ! r2 "?list-type=2&prefix=secrets/" "${WORK}/liste.xml"; then
  echo "❌ R2 injoignable — les accès R2 sont-ils encore valides ?"; exit 1
fi
ARCHIVE=$(grep -o '<Key>secrets/[^<]*</Key>' "${WORK}/liste.xml" \
  | sed 's|<Key>secrets/||; s|</Key>||' | sort | tail -1)
[ -n "${ARCHIVE}" ] || { echo "❌ Aucune archive sous secrets/."; exit 1; }
echo "   ${ARCHIVE}"
r2 "/secrets/${ARCHIVE}" "${WORK}/archive.enc" || { echo "❌ Téléchargement impossible."; exit 1; }
echo "   $(wc -c < "${WORK}/archive.enc") octets"

# ─── 3. Les candidats du coffre ──────────────────────────────────────────────
echo ""
echo "── 3/4 · lecture du coffre ─────────────────────────────────────────────"
if ! "${BW}" list items --session "${SESSION}" > "${WORK}/items.json" 2>"${WORK}/bw.err"; then
  echo "❌ Lecture du coffre impossible :"; head -3 "${WORK}/bw.err"; exit 1
fi

# Chaque candidat = une ligne "nom_entrée<TAB>nom_champ<TAB>valeur".
# Les valeurs ne sortent jamais de ce fichier temporaire, détruit à la sortie.
python - "${WORK}/items.json" "${WORK}/candidats.tsv" <<'PY'
import json, sys

items = json.load(open(sys.argv[1], encoding="utf-8"))
lignes = []


def ajouter(entree, champ, valeur):
    if not valeur or not isinstance(valeur, str):
        return
    v = valeur.strip()
    # Une passphrase n'est ni un mot ni un roman.
    if not (8 <= len(v) <= 512) or "\n" in v:
        return
    lignes.append((entree, champ, valeur))


for it in items:
    nom = it.get("name") or "(sans nom)"
    login = it.get("login") or {}
    ajouter(nom, "mot de passe", login.get("password"))
    ajouter(nom, "nom d'utilisateur", login.get("username"))
    for f in it.get("fields") or []:
        ajouter(nom, "champ « %s »" % (f.get("name") or "?"), f.get("value"))
    notes = it.get("notes")
    if notes:
        for i, l in enumerate(notes.splitlines(), 1):
            l = l.strip()
            # Une note du genre "CLE=valeur" : on tente aussi la partie droite.
            if "=" in l and not l.startswith("#"):
                ajouter(nom, "note ligne %d (après =)" % i, l.split("=", 1)[1].strip())
            ajouter(nom, "note ligne %d" % i, l)

# Les entrées qui parlent de sauvegarde d'abord : on trouve en général au 1er essai.
def priorite(t):
    texte = (t[0] + " " + t[1]).lower()
    for i, mot in enumerate(("passphrase", "backup", "sauvegarde", "axion", "r2")):
        if mot in texte:
            return i
    return 99


lignes.sort(key=priorite)
# newline="\n" est obligatoire : en mode texte sous Windows, Python traduit
# chaque \n en \r\n, et le `read` de bash laisse alors un \r collé à la dernière
# colonne. Le script conclurait « la valeur ne marche qu'après nettoyage » —
# en accusant le coffre d'une saleté que l'instrument vient d'ajouter.
with open(sys.argv[2], "w", encoding="utf-8", newline="\n") as f:
    for e, c, v in lignes:
        f.write("%s\t%s\t%s\n" % (e.replace("\t", " "), c.replace("\t", " "), v))
print("   %d entrées lues, %d valeurs à essayer" % (len(items), len(lignes)))
PY
[ -s "${WORK}/candidats.tsv" ] || { echo "❌ Aucune valeur exploitable dans le coffre."; exit 1; }

# ─── 4. Laquelle ouvre l'archive ? ───────────────────────────────────────────
echo ""
echo "── 4/4 · laquelle ouvre l'archive ? ────────────────────────────────────"
TROUVE=""
ESSAIS=0
while IFS=$'\t' read -r ENTREE CHAMP VALEUR; do
  [ -z "${VALEUR}" ] && continue
  ESSAIS=$((ESSAIS + 1))
  for FORME in brut ajuste; do
    if [ "${FORME}" = "ajuste" ]; then
      CANDIDAT=$(printf '%s' "${VALEUR}" | tr -d ' \t\r\n')
      [ "${CANDIDAT}" = "${VALEUR}" ] && continue
    else
      CANDIDAT="${VALEUR}"
    fi
    if BACKUP_ENCRYPTION_PASSPHRASE="${CANDIDAT}" openssl enc -d -aes-256-cbc -salt \
      -pbkdf2 -iter 100000 -pass "env:BACKUP_ENCRYPTION_PASSPHRASE" \
      -in "${WORK}/archive.enc" 2>/dev/null | gunzip 2>/dev/null | tar -tf - >/dev/null 2>&1; then
      TROUVE="${ENTREE}|${CHAMP}|${FORME}|${#CANDIDAT}"
      break 2
    fi
  done
done < "${WORK}/candidats.tsv"

echo "   ${ESSAIS} valeurs essayées"
echo ""

if [ -z "${TROUVE}" ]; then
  cat <<'ECHEC'
🔴 AUCUNE VALEUR DU COFFRE N'OUVRE L'ARCHIVE.

   Le coffre ne contient donc pas la passphrase de sauvegarde en état de servir.
   Si le VPS et Coolify disparaissaient, les sauvegardes R2 seraient illisibles.

   À faire, dans cet ordre :
   1. Coolify → Applications → axion-ia → Environment Variables →
      BACKUP_ENCRYPTION_PASSPHRASE → l'œil pour révéler la valeur (64 caractères) ;
   2. la copier dans une entrée Bitwarden dédiée, en champ personnalisé nommé
      BACKUP_ENCRYPTION_PASSPHRASE, sans espace ni retour à la ligne ;
   3. relancer ce script jusqu'au feu vert.
ECHEC
  exit 1
fi

IFS='|' read -r E C F L <<< "${TROUVE}"
echo "🟢 LE COFFRE OUVRE BIEN L'ARCHIVE."
echo ""
echo "   Entrée   : ${E}"
echo "   Champ    : ${C}"
echo "   Longueur : ${L} caractères"
if [ "${F}" = "ajuste" ]; then
  echo ""
  echo "   ⚠️  Elle n'a fonctionné qu'APRÈS suppression d'espaces ou de retours à"
  echo "       la ligne parasites. Elle ouvre l'archive, mais un copier-coller en"
  echo "       situation de crise échouerait. Nettoie l'entrée du coffre."
fi
echo ""
echo "   La reprise à froid est possible avec cette entrée seule + le runbook R33."
