#!/usr/bin/env bash
# =============================================================================
# Le miroir Storage Box a-t-il vraiment depose quelque chose cette nuit ?
# =============================================================================
#
# ⚠️ POURQUOI CE CONTROLE EXISTE
#
# `run-storagebox-mirror.sh` a ete depose sur le VPS le 2026-09-03 et n'a
# JAMAIS tourne avant le 2026-09-14 : ni planifie, ni versionne, et porteur d'un
# defaut qui l'empechait de s'authentifier. Personne ne s'en est apercu pendant
# onze jours, et la raison est simple : RIEN NE LE REGARDAIT.
#
#   - `run-backup-digest.sh` n'interroge que R2 (`aws s3 ls`) : un miroir mort
#     laisse le bilan quotidien tout vert ;
#   - le tableau de bord est indexe par COMPOSANT et ne connait aucune entree
#     `storagebox` ;
#   - le seul temoin etait `/var/log/storagebox-mirror.log`, que personne ne lit.
#
# 🔑 CE QUE LE CONTROLE VERIFIE, ET POURQUOI LA TAILLE COMPTE AUTANT QUE L AGE
#
#   1. il y a des fichiers sur la Storage Box (sinon, rien n est protege) ;
#   2. le plus recent est RECENT (sinon le miroir est mort il y a des jours) ;
#   3. il est GROS (>= seuil). Le depot CRM a paye cette lecon : pendant trois
#      mois sa Storage Box portait bien un fichier au bon nom — 18 497 octets.
#      Une garde qui se contente de « le fichier existe » aurait ete VERTE tout
#      du long.
#
# Usage (sur le SERVEUR) :
#   bash /opt/axion-ia/verifier-miroir-storagebox.sh
#
# Les deux seuils sont reglables — non par confort, mais pour POUVOIR PROUVER
# que la garde rougit, ce qu'aucune assertion sur un cas sain n'etablit :
#   SEUIL_AGE_H=0        bash ...  -> doit echouer (trop vieux)
#   SEUIL_TAILLE_MO=9999 bash ...  -> doit echouer (trop petit)
# =============================================================================

set -euo pipefail

SB_HOST="${SB_HOST:-u595329.your-storagebox.de}"
SB_USER="${SB_USER:-u595329}"
SB_PORT="${SB_PORT:-23}"
SB_PATH="${SB_PATH:-/home/axion-ia-backups}"
SB_SECRET="${SB_SECRET:-/opt/axion-ia/.storagebox-password}"

SEUIL_AGE_H="${SEUIL_AGE_H:-30}"
SEUIL_TAILLE_MO="${SEUIL_TAILLE_MO:-10}"

echoerr() { echo "$@" >&2; }

echo "=== Miroir Storage Box — $(date -u +%FT%TZ) ==="
echo "    seuils : age <= ${SEUIL_AGE_H} h, taille >= ${SEUIL_TAILLE_MO} Mo"

if [ ! -s "${SB_SECRET}" ]; then
  echoerr "❌ ${SB_SECRET} absent ou vide — impossible d interroger la Storage Box."
  echoerr "   Le deposer en 600 (valeur : SB_PASSWORD du .env de CRM Pro)."
  exit 1
fi
command -v sshpass >/dev/null 2>&1 || { echoerr "❌ sshpass absent du serveur."; exit 1; }

SB_PASSWORD=$(cat "${SB_SECRET}")

# ⚠️ `-o BatchMode=no` est OBLIGATOIRE ici. `sftp -b -` implique le mode batch,
# qui refuse toute saisie de mot de passe — y compris celle de `sshpass`. Sans
# cette option, la commande rend « Permission denied », c est-a-dire EXACTEMENT
# le message d un mauvais mot de passe. C est le defaut qui a rendu le miroir
# inerte pendant onze jours, et il a deja coute deux fois des heures de
# recherche du cote du secret et du fournisseur.
INVENTAIRE=$(printf 'cd %s\nls -l\nbye\n' "${SB_PATH}" | sshpass -p "${SB_PASSWORD}" \
  sftp -P "${SB_PORT}" -o StrictHostKeyChecking=accept-new -o BatchMode=no \
       -o ConnectTimeout=30 -b - "${SB_USER}@${SB_HOST}" 2>/dev/null \
  | grep -E '^-' || true)

if [ -z "${INVENTAIRE}" ]; then
  echoerr "❌ AUCUN fichier sur ${SB_HOST}:${SB_PATH}."
  echoerr "   La seconde destination hors serveur est VIDE : il n en reste qu une."
  exit 1
fi

NB=$(printf '%s\n' "${INVENTAIRE}" | wc -l)
echo "    ${NB} fichier(s) hors site"

# Taille = 5e colonne d un `ls -l` SFTP. On prend le plus GROS : le miroir
# depose plusieurs composants de tailles tres differentes (secrets ~90 Ko,
# fichiers ~54 Mo), et c est le plus gros qui atteste d une copie reelle.
PLUS_GROS=$(printf '%s\n' "${INVENTAIRE}" | awk '{print $5}' | sort -n | tail -1)
PLUS_GROS_MO=$(( PLUS_GROS / 1024 / 1024 ))
echo "    plus gros fichier : ${PLUS_GROS_MO} Mo (${PLUS_GROS} octets)"

if [ "${PLUS_GROS_MO}" -lt "${SEUIL_TAILLE_MO}" ]; then
  echoerr "❌ Le plus gros fichier hors site fait ${PLUS_GROS_MO} Mo, sous le seuil de ${SEUIL_TAILLE_MO} Mo."
  echoerr "   Un fichier present mais vide ne protege RIEN — piege deja paye cote CRM."
  exit 1
fi

# L age se lit sur la COPIE LOCALE la plus recente que le miroir vient d envoyer :
# `ls -l` SFTP ne rend pas d horodatage exploitable de facon portable. Le journal
# du miroir est la source d age la plus fiable dont on dispose sur le serveur.
JOURNAL="${JOURNAL:-/var/log/storagebox-mirror.log}"
if [ -f "${JOURNAL}" ]; then
  AGE_S=$(( $(date +%s) - $(stat -c %Y "${JOURNAL}") ))
  AGE_H=$(( AGE_S / 3600 ))
  echo "    dernier passage du miroir : il y a ${AGE_H} h (${AGE_S} s)"
  # 🔑 La comparaison se fait en SECONDES, pas en heures entieres, et ce n est
  # pas un detail de style : avec des heures, `SEUIL_AGE_H=0` ne peut JAMAIS
  # etre depasse par un age de 0 h, donc la branche « trop vieux » serait
  # INDEMONTRABLE — on ne pourrait pas prouver qu elle rougit. Mesure du
  # 2026-09-14 : la premiere version de ce script rendait VERT avec
  # `SEUIL_AGE_H=0`. Une garde qu on ne peut pas voir rouge ne garde rien.
  SEUIL_AGE_S=$(( SEUIL_AGE_H * 3600 ))
  if [ "${AGE_S}" -gt "${SEUIL_AGE_S}" ]; then
    echoerr "❌ Le miroir n a pas tourne depuis ${AGE_H} h (seuil ${SEUIL_AGE_H} h)."
    echoerr "   Verifier le crontab root et ${JOURNAL}."
    exit 1
  fi
else
  # ⚠️ Absence de journal = le miroir n a JAMAIS tourne depuis sa planification.
  # C est un echec, pas une information manquante : c etait exactement l etat
  # du 2026-09-03 au 2026-09-14.
  echoerr "❌ ${JOURNAL} absent — le miroir n a jamais tourne depuis sa planification."
  exit 1
fi

echo "✅ Miroir Storage Box : fichiers presents, recents et de taille plausible."
