#!/usr/bin/env bash
# Drill de restauration de l'archive SECRETS depuis Cloudflare R2.
#
# ## Le défaut que ce script ferme
#
# Le job `secrets-integrity` du drill mensuel ne faisait qu'un `head-object` :
# il vérifiait qu'un objet existait et pesait plus de zéro octet, **sans jamais
# le déchiffrer**. Et il ne le faisait même pas : il visait
# `R2_BUCKET_IMMUTABLE`, une variable jamais configurée, donc il sortait en
# `exit 0` sur un `::warning::` que personne ne lit. Résultat : l'archive dont
# on a besoin le jour où Coolify n'est plus là était la SEULE dont la
# restauration n'avait jamais été prouvée.
#
# Une archive chiffrée avec une passphrase perdue pèse le même poids qu'une
# archive saine. Seul le déchiffrement distingue les deux.
#
# ## Ce que ce script prouve
#
#   1. l'objet le plus récent de `secrets/` se télécharge ;
#   2. il se DÉCHIFFRE avec `BACKUP_ENCRYPTION_PASSPHRASE` ;
#   3. il se décompresse et se dé-tar ;
#   4. son contenu est celui d'une reprise à froid : les variables du site, le
#      `SECRET_KEY_BASE` de Docuseal, les identifiants de base, et le `printenv`
#      d'un nombre plausible de conteneurs.
#
# Le point 4 compte autant que les trois autres : une archive parfaitement
# valide et parfaitement vide passerait les points 1 à 3 en donnant un voyant
# vert et zéro secret. C'est le faux positif que ce drill refuse.
#
# ⚠️ Ce script LIT des secrets de production. Il n'en imprime aucun : seulement
# des noms de clés, des comptes et des longueurs.
#
# Variables requises :
#   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT / R2_BUCKET_NAME
#   BACKUP_ENCRYPTION_PASSPHRASE
#
# Sortie : 0 = archive restaurée et complète · 2 = format v1 (héritée, partielle)
#          1 = échec réel.
set -euo pipefail

LIB="$(dirname "$0")/backup-lib.sh"
# shellcheck source=scripts/backup-lib.sh
source "${LIB}"

require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY
require_var R2_ENDPOINT
require_var R2_BUCKET_NAME
require_var BACKUP_ENCRYPTION_PASSPHRASE

WORK=$(mktemp -d)
chmod 700 "${WORK}"
trap 'rm -rf "${WORK}"' EXIT

echo "── 1/4 · dernière archive de secrets/ ──────────────────────────────────"
LATEST=$(s3 s3 ls "s3://${R2_BUCKET_NAME}/secrets/" | awk '{print $4}' | sort | tail -1)
if [ -z "${LATEST}" ]; then
  echo "❌ Aucune archive sous secrets/ dans ${R2_BUCKET_NAME}"
  exit 1
fi
echo "   ${LATEST}"

echo "── 2/4 · téléchargement ────────────────────────────────────────────────"
if ! s3 s3 cp "s3://${R2_BUCKET_NAME}/secrets/${LATEST}" "${WORK}/archive.enc" >/dev/null; then
  echo "❌ Téléchargement impossible"
  exit 1
fi
echo "   $(stat -c%s "${WORK}/archive.enc") octets"

echo "── 3/4 · déchiffrement AES + extraction ────────────────────────────────"
mkdir -p "${WORK}/out"
if ! decrypt_aes < "${WORK}/archive.enc" | gunzip | tar -C "${WORK}/out" -xf -; then
  echo "❌ Déchiffrement ou extraction impossible."
  echo "   Cause la plus probable : BACKUP_ENCRYPTION_PASSPHRASE ne correspond pas"
  echo "   à celle qui a chiffré l'archive. C'est exactement le scénario que ce"
  echo "   drill existe pour détecter AVANT le jour où on en a besoin."
  exit 1
fi
echo "   $(find "${WORK}/out" -type f | wc -l) fichiers extraits"

echo "── 4/4 · l'archive contient-elle de quoi repartir ? ────────────────────"
if [ ! -f "${WORK}/out/INVENTAIRE.json" ]; then
  echo "⚠️  Archive au format v1 (variables du site seules, ni Docuseal, ni bases)."
  echo "   Elle se restaure, mais elle ne suffit pas à une reprise à froid."
  exit 2
fi

python3 - "${WORK}/out" <<'PY'
import glob
import json
import os
import sys

racine = sys.argv[1]
echecs = []


def valeur(entree):
    for cle in ("real_value", "value"):
        if entree.get(cle):
            return entree[cle]
    return ""


fichiers = glob.glob(os.path.join(racine, "coolify", "applications-*.json"))
fichiers += glob.glob(os.path.join(racine, "coolify", "services-*.json"))
if len(fichiers) < 4:
    echecs.append(f"{len(fichiers)} applications/services capturés (attendu >= 4)")

# uuid -> nom, pour viser LA ressource et non « une ressource qui a la clé ».
# Docuseal et Plausible déclarent tous deux un SECRET_KEY_BASE : un contrôle qui
# se contente de trouver la clé quelque part peut valider celui de Plausible et
# déclarer Docuseal sauvegardé alors qu'il ne l'est pas.
noms = {}
for index in ("_applications.json", "_services.json"):
    chemin = os.path.join(racine, "coolify", index)
    if os.path.exists(chemin):
        for r in json.load(open(chemin, encoding="utf-8")):
            noms[r.get("uuid")] = (r.get("name") or "").lower()

total = renseignees = 0
docuseal = None
for f in fichiers:
    uuid = os.path.basename(f).split("-", 1)[1].rsplit(".json", 1)[0]
    est_docuseal = "docuseal" in noms.get(uuid, "")
    for e in json.load(open(f, encoding="utf-8")):
        total += 1
        v = valeur(e)
        if v:
            renseignees += 1
        if est_docuseal and e.get("key") == "SECRET_KEY_BASE":
            docuseal = v
print(f"   variables d'application/service : {total} dont {renseignees} renseignées")
if renseignees < 100:
    echecs.append(f"seulement {renseignees} variables renseignées (attendu >= 100)")

if not any("docuseal" in n for n in noms.values()):
    echecs.append("aucune ressource Docuseal dans l'inventaire de l'archive")
elif not docuseal:
    echecs.append("SECRET_KEY_BASE de Docuseal absent ou vide")
else:
    print(f"   SECRET_KEY_BASE de Docuseal : présent ({len(docuseal)} caractères)")

bases = glob.glob(os.path.join(racine, "coolify", "databases-*.json"))
avec_creds = 0
for f in bases:
    d = json.load(open(f, encoding="utf-8"))
    if d.get("postgres_password") or d.get("internal_db_url"):
        avec_creds += 1
print(f"   bases : {len(bases)} dont {avec_creds} avec identifiants")
if avec_creds < 2:
    echecs.append(f"seulement {avec_creds} bases avec identifiants (attendu >= 2)")

runtime = glob.glob(os.path.join(racine, "runtime-env", "*.env"))
print(f"   printenv de conteneurs : {len(runtime)}")
if len(runtime) < 10:
    echecs.append(f"seulement {len(runtime)} printenv (attendu >= 10)")

if echecs:
    print("")
    print("❌ Archive restaurée mais INCOMPLÈTE :")
    for e in echecs:
        print(f"   · {e}")
    sys.exit(1)
print("")
print("✅ Archive complète : la reprise à froid est possible avec ce seul fichier.")
PY
