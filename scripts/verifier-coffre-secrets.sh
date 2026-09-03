#!/usr/bin/env bash
# Vérifie que la passphrase gardée au coffre (Bitwarden) déchiffre BIEN la
# dernière sauvegarde de secrets sur R2.
#
# ## Pourquoi ce script existe
#
# `BACKUP_ENCRYPTION_PASSPHRASE` est le seul secret qui ne peut pas être dans la
# sauvegarde : c'est lui qui la chiffre. Il ne vit donc qu'à deux endroits — les
# variables Coolify, et le coffre. Le jour où le VPS et Coolify disparaissent
# ensemble, la copie du coffre est la seule qui reste, et c'est le pire moment
# pour découvrir qu'elle a été mal recopiée, tronquée, ou prise avant une
# rotation.
#
# Ce script répond à la seule question qui compte : **la phrase que j'ai au
# coffre ouvre-t-elle l'archive ?**
#
# ## Ce qu'il ne fait pas
#
# La passphrase est saisie en frappe masquée, n'est jamais affichée, jamais
# écrite sur le disque, jamais passée en argument (donc invisible dans
# l'historique du shell et dans la liste des processus), et ne sort pas de la
# machine : tout se joue entre ce poste et R2. Les fichiers déchiffrés
# atterrissent dans un dossier temporaire détruit à la sortie, y compris en cas
# d'erreur ou d'interruption.
#
# ## Usage
#
#   bash scripts/verifier-coffre-secrets.sh [chemin/vers/api-tokens.env]
#
# Les accès R2 sont lus dans l'environnement s'ils y sont, sinon dans le fichier
# passé en argument (par défaut `../.secrets/api-tokens.env`, hors dépôt).
set -euo pipefail

CREDS="${1:-$(dirname "$0")/../../.secrets/api-tokens.env}"

charger() {
  local nom="$1"
  if [ -n "${!nom:-}" ]; then return 0; fi
  if [ -f "${CREDS}" ]; then
    local v
    v=$(grep -E "^${nom}=" "${CREDS}" | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')
    if [ -n "${v}" ]; then
      printf -v "${nom}" '%s' "${v}"
      export "${nom?}"
      return 0
    fi
  fi
  echo "❌ ${nom} introuvable (ni dans l'environnement, ni dans ${CREDS})" >&2
  exit 1
}
for v in R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT R2_BUCKET_NAME; do charger "$v"; done

WORK=$(mktemp -d)
trap 'rm -rf "${WORK}"' EXIT INT TERM

r2() { # r2 <chemin+requête> <fichier de sortie>
  curl -sS --fail-with-body \
    --aws-sigv4 "aws:amz:auto:s3" \
    --user "${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}" \
    -o "$2" "${R2_ENDPOINT%/}/${R2_BUCKET_NAME}$1"
}

echo "── Dernière sauvegarde de secrets sur R2 ───────────────────────────────"
if ! r2 "?list-type=2&prefix=secrets/" "${WORK}/liste.xml"; then
  echo "❌ Impossible d'interroger R2. Les accès R2 sont-ils encore valides ?" >&2
  exit 1
fi
ARCHIVE=$(grep -o '<Key>secrets/[^<]*</Key>' "${WORK}/liste.xml" \
  | sed 's|<Key>secrets/||; s|</Key>||' | sort | tail -1)
if [ -z "${ARCHIVE}" ]; then
  echo "❌ Aucune archive sous secrets/ — il n'y a rien à vérifier." >&2
  exit 1
fi
echo "   ${ARCHIVE}"

echo "── Téléchargement ──────────────────────────────────────────────────────"
if ! r2 "/secrets/${ARCHIVE}" "${WORK}/archive.enc"; then
  echo "❌ Téléchargement impossible." >&2
  exit 1
fi
echo "   $(wc -c < "${WORK}/archive.enc") octets"

echo ""
echo "Ouvre Bitwarden, copie BACKUP_ENCRYPTION_PASSPHRASE, et colle-la ici."
echo "Rien ne s'affichera pendant la frappe. Valide avec Entrée."
printf "Passphrase du coffre : "
read -r -s BACKUP_ENCRYPTION_PASSPHRASE
export BACKUP_ENCRYPTION_PASSPHRASE
echo ""
echo ""

echo "── Déchiffrement ───────────────────────────────────────────────────────"
mkdir -p "${WORK}/out"
if openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 100000 \
  -pass "env:BACKUP_ENCRYPTION_PASSPHRASE" -in "${WORK}/archive.enc" 2>/dev/null \
  | gunzip 2>/dev/null | tar -C "${WORK}/out" -xf - 2>/dev/null; then
  :
else
  echo ""
  echo "🔴 CETTE PASSPHRASE N'OUVRE PAS L'ARCHIVE."
  echo ""
  echo "   Ce qu'il faut faire, dans cet ordre :"
  echo "   1. vérifier qu'il n'y a ni espace ni retour à la ligne collé en trop ;"
  echo "   2. si le doute persiste, relire la valeur dans Coolify"
  echo "      (Application axion-ia → Environment Variables →"
  echo "       BACKUP_ENCRYPTION_PASSPHRASE) et corriger l'entrée du coffre ;"
  echo "   3. relancer ce script jusqu'à obtenir le feu vert."
  echo ""
  echo "   Tant que ce script ne passe pas, les sauvegardes R2 ne sont"
  echo "   récupérables QUE tant que Coolify répond."
  exit 1
fi

APPS=$(find "${WORK}/out/coolify" -name 'applications-*.json' 2>/dev/null | wc -l)
BASES=$(find "${WORK}/out/coolify" -name 'databases-*.json' 2>/dev/null | wc -l)
RUNTIME=$(find "${WORK}/out/runtime-env" -name '*.env' 2>/dev/null | wc -l)

echo ""
echo "🟢 LA PASSPHRASE DU COFFRE OUVRE BIEN L'ARCHIVE."
echo ""
echo "   Contenu lisible : ${APPS} applications, ${BASES} bases, ${RUNTIME} conteneurs."
echo "   Si Coolify et le VPS disparaissaient maintenant, cette archive plus"
echo "   cette phrase suffiraient à repartir (runbook R33, Voie B)."
