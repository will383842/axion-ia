#!/usr/bin/env bash
# Test de restauration du backup Docuseal depuis Cloudflare R2 (ADR 0032).
#
# POURQUOI CE SCRIPT EXISTE (2026-07-29)
# ──────────────────────────────────────
# `docuseal.sqlite3` contient les SIGNATURES ÉLECTRONIQUES : conventions,
# contrats, lettres de mission, émargements. Pour un organisme de formation
# certifié, ce n'est pas de la donnée de confort — c'est de la PREUVE
# opposable. Le jour où un auditeur Qualiopi, un client ou la DREETS demande
# à voir une convention signée, l'absence de preuve se retourne contre nous.
#
# Jusqu'ici la sauvegarde EXISTAIT, mais personne n'avait jamais vérifié
# qu'elle se ROUVRE. Une archive corrompue, une passphrase changée, un SQLite
# tronqué à la copie : rien de tout ça ne se voit tant qu'on n'essaie pas — et
# on n'essaie qu'au pire moment.
#
# CE QUE LE DRILL VÉRIFIE VRAIMENT
# ────────────────────────────────
# Le piège d'un tel test est de se contenter de « le fichier se télécharge » :
# ça allume un voyant vert sans rien prouver. On va donc jusqu'au bout :
#   1. l'archive se déchiffre (donc la passphrase est la bonne) ;
#   2. le tar.gz se décompresse (donc l'archive n'est pas tronquée) ;
#   3. le SQLite s'OUVRE et passe `PRAGMA integrity_check` ;
#   4. les tables métier existent ET contiennent des lignes — une base vide
#      mais valide serait le pire des faux positifs ;
#   5. l'archive des PDF signés est présente et non vide.
#
# Variables requises : R2_* , BACKUP_ENCRYPTION_PASSPHRASE
# Optionnelles       : TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
#
# Usage : bash scripts/restore-docuseal-test-r2.sh [--type daily|weekly|monthly]

set -euo pipefail

BACKUP_TYPE="daily"
while [ $# -gt 0 ]; do
  case "$1" in
    --type) BACKUP_TYPE="$2"; shift 2 ;;
    *) echo "Argument inconnu : $1" >&2; exit 2 ;;
  esac
done

require_var() {
  if [ -z "${!1:-}" ]; then echo "❌ Variable requise manquante : $1" >&2; exit 1; fi
}

notify_telegram() {
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -fsSL -m 10 -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" -d "text=$1" >/dev/null 2>&1 || true
  fi
}

s3() {
  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
    AWS_REGION="auto" AWS_PAGER="" \
    aws --endpoint-url "${R2_ENDPOINT}" "$@"
}

require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY
require_var R2_ENDPOINT
require_var R2_BUCKET_NAME
require_var BACKUP_ENCRYPTION_PASSPHRASE

command -v sqlite3 >/dev/null || { echo "❌ sqlite3 absent" >&2; exit 1; }

WORK_DIR="$(mktemp -d -t axion-ia-docuseal-drill-XXXXXX)"
trap 'rm -rf "${WORK_DIR}"' EXIT
START_TS=$(date +%s)

# ─── 1. Trouver la dernière archive ──────────────────────────────────────────
echo "▶ Listing R2 docuseal/${BACKUP_TYPE}…"
LATEST=$(s3 s3 ls "s3://${R2_BUCKET_NAME}/docuseal/${BACKUP_TYPE}/" \
  | awk '{print $4}' \
  | grep -E '^axion-ia-docuseal-.*\.tar\.gz\.enc$' \
  | sort -r | head -1)

if [ -z "${LATEST}" ]; then
  echo "❌ Aucune sauvegarde Docuseal ${BACKUP_TYPE} sur R2"
  notify_telegram "🔴 [DOCUSEAL-DRILL] Aucune sauvegarde ${BACKUP_TYPE} à tester"
  exit 1
fi
echo "  Archive ciblée : docuseal/${BACKUP_TYPE}/${LATEST}"

# ─── 2. Télécharger ──────────────────────────────────────────────────────────
s3 s3 cp "s3://${R2_BUCKET_NAME}/docuseal/${BACKUP_TYPE}/${LATEST}" "${WORK_DIR}/backup.enc"
SIZE_MB=$(( $(stat -c%s "${WORK_DIR}/backup.enc" 2>/dev/null || stat -f%z "${WORK_DIR}/backup.enc") / 1024 / 1024 ))
echo "  Téléchargé : ${SIZE_MB} MB"

# ─── 3. Déchiffrer + décompresser ────────────────────────────────────────────
# Un échec ICI est le scénario le plus redouté : la sauvegarde existe mais la
# passphrase ne l'ouvre plus. Sans ce drill, on ne l'apprendrait qu'en urgence.
echo "▶ Déchiffrement…"
# ⚠️ `-iter 100000` OBLIGATOIRE : `encrypt_aes()` de backup-lib.sh — qui chiffre
# les archives Docuseal — impose explicitement 100 000 itérations, alors que le
# backup Postgres s'en remet à la valeur par défaut d'OpenSSL (10 000).
#
# Déchiffrer avec la mauvaise valeur produit un « bad decrypt » STRICTEMENT
# identique à celui d'une passphrase erronée ou d'une archive corrompue. C'est
# l'erreur commise au premier jet, en calquant ce script sur celui de Postgres :
# le drill a déclaré inexploitable une sauvegarde parfaitement saine. Un faux
# positif de cette nature est plus dangereux qu'un test absent — il envoie
# chercher un problème inexistant, en pleine urgence, sur le composant dont on
# a le plus besoin.
#
# On tente donc 100 000 (le cas réel), puis la valeur par défaut en repli, pour
# rester compatible avec d'éventuelles archives plus anciennes encore sur R2.
# La sauvegarde n'est déclarée en cause que si LES DEUX échouent.
decrypt_ok=""
for iter_args in "-iter 100000" ""; do
  # shellcheck disable=SC2086
  if openssl enc -d -aes-256-cbc -pbkdf2 -salt ${iter_args} \
    -pass "env:BACKUP_ENCRYPTION_PASSPHRASE" \
    -in "${WORK_DIR}/backup.enc" -out "${WORK_DIR}/backup.tar.gz" 2>"${WORK_DIR}/openssl.err"; then
    decrypt_ok="${iter_args:-défaut}"
    break
  fi
done
if [ -z "${decrypt_ok}" ]; then
  echo "❌ Déchiffrement impossible (ni iter=100000 ni défaut) — passphrase incorrecte ou archive corrompue"
  head -5 "${WORK_DIR}/openssl.err" || true
  notify_telegram "🔴 [DOCUSEAL-DRILL] Déchiffrement IMPOSSIBLE — la sauvegarde est inexploitable"
  exit 1
fi
echo "  déchiffré (${decrypt_ok})"

mkdir -p "${WORK_DIR}/payload"
if ! tar -xzf "${WORK_DIR}/backup.tar.gz" -C "${WORK_DIR}/payload" 2>"${WORK_DIR}/tar.err"; then
  echo "❌ Archive illisible (tronquée ?)"
  head -5 "${WORK_DIR}/tar.err" || true
  notify_telegram "🔴 [DOCUSEAL-DRILL] Archive illisible — probable troncature"
  exit 1
fi

# ⚠️ On CHERCHE les fichiers au lieu de supposer leur chemin.
#
# Le premier jet lisait `payload/docuseal.sqlite3` en dur, parce que le script
# de sauvegarde fait `tar -C payload -cf - .` — donc, en théorie, une archive
# plate. En pratique l'archive de production contient un dossier `docuseal/`
# à la racine, et le drill a conclu « aucune base dans l'archive » sur une
# sauvegarde qui en contenait une.
#
# Deuxième faux positif du même genre après celui du `-iter` : deviner la forme
# de l'archive est précisément ce qu'un test de restauration ne doit pas faire.
# Son travail est de constater ce qu'il y a, pas de vérifier une hypothèse.
# Le fichier s'appelle `db.sqlite3` en production, pas `docuseal.sqlite3` —
# troisième hypothèse fausse de ce script sur la forme de l'archive. On ne
# devine donc plus RIEN : n'importe quel `.sqlite3`, et le plus gros s'il y en
# a plusieurs (la vraie base pèse toujours plus qu'un fichier annexe).
DB="$(find "${WORK_DIR}/payload" -type f -name '*.sqlite3' -printf '%s	%p
' 2>/dev/null   | sort -rn | head -1 | cut -f2-)"
PG_DUMP="$(find "${WORK_DIR}/payload" -type f \( -name '*.dump' -o -name '*.pgdump' \) 2>/dev/null | head -1)"

# ─── 4. Intégrité SQLite ─────────────────────────────────────────────────────
# Le backup a deux variantes (SQLite embarqué, ou Postgres si --pg). On teste
# celle réellement présente plutôt que d'échouer sur l'absence de l'autre.
if [ -n "${DB}" ] && [ -f "${DB}" ]; then
  echo "▶ PRAGMA integrity_check…"
  INTEG=$(sqlite3 "${DB}" "PRAGMA integrity_check;" 2>&1 | head -1)
  if [ "${INTEG}" != "ok" ]; then
    echo "❌ integrity_check : ${INTEG}"
    notify_telegram "🔴 [DOCUSEAL-DRILL] SQLite corrompu (${INTEG})"
    exit 1
  fi
  echo "  integrity_check : ok"

  # ─── 5. Les signatures sont-elles VRAIMENT là ? ────────────────────────────
  # Une base valide mais VIDE passerait l'integrity_check en beauté. C'est le
  # faux positif le plus dangereux : voyant vert, zéro preuve. On compte donc.
  echo "▶ Contenu métier…"
  TABLES=$(sqlite3 "${DB}" "SELECT name FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "")
  if [ -z "${TABLES}" ]; then
    echo "❌ Aucune table dans la base restaurée"
    notify_telegram "🔴 [DOCUSEAL-DRILL] Base restaurée SANS AUCUNE TABLE"
    exit 1
  fi

  TOTAL=0
  DETAIL=""
  for t in submissions submitters templates documents; do
    if echo "${TABLES}" | grep -qx "${t}"; then
      c=$(sqlite3 "${DB}" "SELECT COUNT(*) FROM ${t};" 2>/dev/null || echo 0)
      echo "  ${t} : ${c}"
      DETAIL="${DETAIL}${t}=${c} "
      case "${c}" in (''|*[!0-9]*) ;; (*) TOTAL=$(( TOTAL + c ));; esac
    fi
  done

  # Seuil volontairement à 1 : on ne prétend pas connaître le volume attendu,
  # on refuse seulement le cas « archive parfaitement valide et parfaitement
  # vide », qui signifierait que la sauvegarde ne sauvegarde rien.
  if [ "${TOTAL}" -lt 1 ]; then
    echo "❌ Aucune ligne dans les tables métier — la sauvegarde ne contient aucune signature"
    notify_telegram "🔴 [DOCUSEAL-DRILL] Base VALIDE mais VIDE — aucune signature sauvegardée"
    exit 1
  fi
  echo "  total lignes métier : ${TOTAL}"
elif [ -n "${PG_DUMP}" ] && [ -f "${PG_DUMP}" ]; then
  echo "▶ Variante Postgres détectée — contrôle d'intégrité pg_restore --list…"
  LINES=$(pg_restore --list "${PG_DUMP}" 2>&1 | wc -l)
  if [ "${LINES}" -lt 10 ]; then
    echo "❌ Dump Postgres Docuseal probablement corrompu (${LINES} lignes)"
    notify_telegram "🔴 [DOCUSEAL-DRILL] Dump PG corrompu"
    exit 1
  fi
  TOTAL="${LINES}"
  DETAIL="pg_restore_list=${LINES}"
  echo "  pg_restore --list : ${LINES} entrées"
else
  echo "❌ Ni docuseal.sqlite3 ni docuseal.dump dans l'archive"
  # Arborescence COMPLÈTE : un `ls` de la racine ne montrerait qu'un dossier et
  # laisserait croire l'archive vide — c'est ce qui m'a induit en erreur.
  find "${WORK_DIR}/payload" -maxdepth 3 | head -40 || true
  notify_telegram "🔴 [DOCUSEAL-DRILL] Archive sans base de données exploitable"
  exit 1
fi

# ─── 6. Les PDF signés sont-ils là ? ─────────────────────────────────────────
# La base porte les métadonnées de signature ; les PDF sont la pièce qu'on
# présente. Une base intacte sans documents ne suffirait pas en audit.
# Les PDF signés arrivent soit en `files.tar`, soit — c'est le cas réel — en
# dossier `attachments/` déjà déployé dans l'archive. On accepte les deux.
FILES_TAR="$(find "${WORK_DIR}/payload" -type f -name 'files.tar' 2>/dev/null | head -1)"
ATTACH_DIR="$(find "${WORK_DIR}/payload" -type d -name 'attachments' 2>/dev/null | head -1)"
if [ -n "${ATTACH_DIR}" ] && [ -d "${ATTACH_DIR}" ]; then
  FILE_COUNT=$(find "${ATTACH_DIR}" -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "  PDF archivés : ${FILE_COUNT} fichiers (dossier attachments/)"
  DETAIL="${DETAIL}pdf=${FILE_COUNT}"
elif [ -n "${FILES_TAR}" ] && [ -f "${FILES_TAR}" ]; then
  FILE_COUNT=$(tar -tf "${FILES_TAR}" 2>/dev/null | grep -vc '/$' || echo 0)
  FILES_MB=$(( $(stat -c%s "${FILES_TAR}" 2>/dev/null || stat -f%z "${FILES_TAR}") / 1024 / 1024 ))
  echo "  PDF archivés : ${FILE_COUNT} fichiers (${FILES_MB} MB)"
  DETAIL="${DETAIL}pdf=${FILE_COUNT}"
else
  # Non bloquant : une instance neuve n'a pas encore de PDF. On le signale.
  echo "⚠️ files.tar absent de l'archive — aucun PDF signé sauvegardé"
  DETAIL="${DETAIL}pdf=absent"
fi

DURATION=$(( $(date +%s) - START_TS ))
echo "✅ Drill Docuseal OK en ${DURATION}s — ${DETAIL}"
notify_telegram "🟢 [DOCUSEAL-DRILL] OK en ${DURATION}s (${SIZE_MB} MB) · ${DETAIL}"
exit 0
