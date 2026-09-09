#!/usr/bin/env bash
# Dépose au coffre Bitwarden la passphrase de données d'Axion Audit.
#
# ## Pourquoi ce script plutôt qu'un copier-coller
#
# Le contrôle `verifier-kit-bitwarden.sh` a établi le 2026-09-03 que
# `BACKUP_ENCRYPTION_PASSPHRASE` d'Axion Audit (43 car., celle qui ouvre ses
# archives de données) n'est PAS au coffre. Sans elle, Axion Audit ne se
# restaure pas — ses sept archives de données deviennent illisibles le jour où
# le serveur disparaît.
#
# La faire transiter par un copier-coller, c'est la faire passer par le
# presse-papiers, l'écran, et souvent une conversation. Ici elle va de Coolify
# au coffre sans jamais s'afficher, ni toucher le disque, ni figurer dans un
# argument de commande — donc invisible dans l'historique du shell et dans la
# liste des processus.
#
# ## Ce que l'opérateur fournit
#
# Son mot de passe maître, une fois. C'est le seul élément que la machine ne
# peut pas avoir : c'est ce qui fait qu'un coffre protège quelque chose.
#
# ## Usage
#
#   bash scripts/deposer-passphrase-audit-au-coffre.sh
set -uo pipefail

AUDIT_UUID="wrunr6mwq2oxqq392i4myzjn"
# ⚠️ Nom en ASCII pur, tiret simple. Sous Windows, `os.environ` décode avec la
# page de code ANSI : un tiret cadratin y ressort corrompu, et l'entrée du
# coffre porterait un nom illisible — mesuré le 2026-09-03.
NOM_ENTREE="Axion Audit - BACKUP_ENCRYPTION_PASSPHRASE"
CREDS="${1:-$(dirname "$0")/../../.secrets/api-tokens.env}"

# ─── La CLI Bitwarden ────────────────────────────────────────────────────────
BW="${BW_BIN:-$(command -v bw 2>/dev/null || true)}"
if [ -z "${BW}" ]; then
  BW=$(find "${LOCALAPPDATA:-/c/Users/$USER/AppData/Local}/Microsoft/WinGet/Packages" \
    -name 'bw.exe' 2>/dev/null | head -1)
fi
[ -n "${BW}" ] || { echo "❌ CLI Bitwarden introuvable (winget install Bitwarden.CLI)"; exit 1; }

IP_VPS="${AXION_VPS_IP:-}"
if [ -z "${IP_VPS}" ] && [ -f "${CREDS}" ]; then
  IP_VPS=$(grep -E '^HETZNER_SERVER_IP=' "${CREDS}" | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')
fi
[ -n "${IP_VPS}" ] || { echo "❌ Adresse du VPS introuvable."; exit 1; }

echo "── 1/4 · lecture de la valeur sur le serveur ───────────────────────────"
VALEUR=$(ssh -o BatchMode=yes -o StrictHostKeyChecking=no "root@${IP_VPS}" \
  "SB=\$(docker ps --format '{{.Names}}' | grep '^sauvegarde-${AUDIT_UUID}' | head -1); \
   docker exec \"\$SB\" printenv BACKUP_ENCRYPTION_PASSPHRASE 2>/dev/null | tr -d '\n'" 2>/dev/null)

if [ -z "${VALEUR}" ]; then
  echo "❌ Valeur illisible sur le serveur — le conteneur de sauvegarde tourne-t-il ?"
  exit 1
fi
EMPREINTE=$(printf %s "${VALEUR}" | sha256sum | cut -d' ' -f1)
echo "   lue : ${#VALEUR} caractères · empreinte ${EMPREINTE:0:16}"
if [ "${#VALEUR}" -ne 43 ]; then
  echo "   ⚠️  longueur inattendue (43 attendus) — vérifie avant de continuer."
fi

# ─── 2. Ouvrir le coffre ─────────────────────────────────────────────────────
echo ""
echo "── 2/4 · ouverture du coffre ───────────────────────────────────────────"
ETAT=$("${BW}" status 2>/dev/null | python -c "import json,sys; print(json.load(sys.stdin).get('status','inconnu'))" 2>/dev/null || echo inconnu)
case "${ETAT}" in
  unauthenticated|inconnu)
    echo "   Coffre non connecté. Adresse e-mail, mot de passe maître, puis 2FA :"
    SESSION=$("${BW}" login --raw) ;;
  *)
    echo "   Mot de passe maître (frappe masquée) :"
    SESSION=$("${BW}" unlock --raw) ;;
esac
[ -n "${SESSION:-}" ] || { echo "❌ Coffre non ouvert — rien n'a été écrit."; exit 1; }
export BW_SESSION="${SESSION}"

# ─── 3. Écrire, sans écraser quoi que ce soit ────────────────────────────────
echo ""
echo "── 3/4 · dépôt de l'entrée ─────────────────────────────────────────────"
# ⚠️ On CRÉE une entrée, on n'en modifie aucune. Éditer une entrée existante
# pour y ajouter une ligne fait courir le risque d'abîmer une passphrase qui,
# elle, fonctionne — un prix sans rapport avec le gain.
DEJA=$("${BW}" list items --search "BACKUP_ENCRYPTION_PASSPHRASE" --session "${SESSION}" 2>/dev/null \
  | python -c "
import json,sys
try:
    for it in json.load(sys.stdin):
        if (it.get('name') or '').strip() == '''${NOM_ENTREE}''':
            print(it.get('id')); break
except Exception: pass" 2>/dev/null)

if [ -n "${DEJA}" ]; then
  echo "   Une entrée « ${NOM_ENTREE} » existe déjà — rien n'est écrit."
  echo "   Supprime-la d'abord si tu veux la remplacer."
else
  # Le gabarit va dans un fichier, la VALEUR passe par l'entrée standard.
  # ⚠️ Surtout pas par l'environnement : `os.environ` sur un secret le rend
  # lisible dans /proc/<pid>/environ, et un shell qui n'a pas EXPORTÉ la
  # variable la rend simplement introuvable — c'est ce qui vient d'échouer.
  TMPD=$(mktemp -d); chmod 700 "${TMPD}"
  PID_ICI=$BASHPID
  trap '[ "$BASHPID" = "$PID_ICI" ] && rm -rf "${TMPD}"' EXIT INT TERM

  if ! "${BW}" get template item --session "${SESSION}" > "${TMPD}/gabarit.json" 2>/dev/null; then
    echo "❌ Gabarit d'entrée illisible."; exit 1
  fi

  CORPS=$(printf '%s' "${VALEUR}" | NOM="${NOM_ENTREE}" GABARIT="${TMPD}/gabarit.json" python -c "
import json, sys, os
t = json.load(open(os.environ['GABARIT'], encoding='utf-8'))
t['type'] = 2
t['name'] = os.environ['NOM']
t['notes'] = sys.stdin.read()
t['secureNote'] = {'type': 0}
for k in ('login', 'card', 'identity'):
    t[k] = None
print(json.dumps(t))
" 2>"${TMPD}/erreur.txt")

  if [ -z "${CORPS}" ]; then
    echo "❌ Construction de l'entrée impossible :"
    head -3 "${TMPD}/erreur.txt" | sed 's/^/     /'
    exit 1
  fi
  if printf '%s' "${CORPS}" | "${BW}" encode | "${BW}" create item --session "${SESSION}" >/dev/null 2>&1; then
    echo "   ✅ entrée créée : ${NOM_ENTREE}"
  else
    echo "❌ Création refusée par le coffre."; exit 1
  fi
fi

# ─── 4. Vérifier ce qui a été écrit, pas ce qu'on croit avoir écrit ──────────
echo ""
echo "── 4/4 · relecture depuis le coffre ────────────────────────────────────"
"${BW}" sync --session "${SESSION}" >/dev/null 2>&1 || true
RELU=$("${BW}" list items --search "BACKUP_ENCRYPTION_PASSPHRASE" --session "${SESSION}" 2>/dev/null \
  | EMPREINTE_CIBLE="${EMPREINTE}" python -c "
import json,sys,hashlib,os
cible = os.environ['EMPREINTE_CIBLE']
for it in json.load(sys.stdin):
    for v in [ (it.get('notes') or '') ] + [ (f.get('value') or '') for f in (it.get('fields') or []) ]:
        for c in (v, v.strip()):
            if c and hashlib.sha256(c.encode()).hexdigest() == cible:
                print(it.get('name')); sys.exit(0)
" 2>/dev/null)

if [ -n "${RELU}" ]; then
  echo "   🟢 CONFIRMÉ — la valeur relue depuis le coffre a la bonne empreinte."
  echo "      Entrée : ${RELU}"
  echo ""
  echo "   Les trois passphrases sont désormais au coffre. Contrôle complet :"
  echo "      bash ~/coffre.sh"
else
  echo "   🔴 La relecture ne retrouve pas la valeur. Ne considère RIEN comme fait."
  exit 1
fi
