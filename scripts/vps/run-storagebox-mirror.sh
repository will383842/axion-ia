#!/usr/bin/env bash
# ============================================================================
# Seconde destination hors serveur : R2 → Hetzner Storage Box
# ============================================================================
#
# ## Le défaut que ce script ferme
#
# Axion-IA et Axion Audit n'avaient qu'UNE destination hors serveur : Cloudflare
# R2. Le service de sauvegarde d'Axion Audit le signalait lui-même dans ses
# journaux, et sa propre spécification en exige deux. R2 indisponible — compte
# suspendu, jeton révoqué, panne du fournisseur — ne laissait que le VPS,
# c'est-à-dire la machine que ces sauvegardes protègent.
#
# La Storage Box existait déjà : CRM Pro y expédie ses archives chaque nuit.
# Elle était simplement inutilisée par les deux autres projets.
#
# ## Pourquoi on recopie depuis R2 et non depuis la source
#
# Les archives sont produites DANS des conteneurs éphémères, envoyées sur R2,
# puis le conteneur disparaît : il n'y a plus de copie locale à pousser. On
# recopie donc depuis R2.
#
# ⚠️ Ce que ça protège, et ce que ça ne protège pas. Le scénario visé —
# « R2 devient inaccessible » — est couvert : la Storage Box porte déjà les
# copies de la veille. Le scénario « R2 perd la donnée la nuit même où elle est
# écrite » ne l'est pas. Le dire est plus utile que de laisser croire à une
# indépendance totale.
#
# ## Ce qui est copié
#
# Le dernier objet de chaque préfixe utile des DEUX buckets. Volume ≈ 70 Mo par
# nuit — négligeable, et c'est pour ça qu'on ne cherche pas à être plus fin.
#
# Les archives sont déjà chiffrées quand elles arrivent ici (AES-256 pour
# Axion-IA, GPG pour Axion Audit) : ce script ne déchiffre jamais rien, il
# déplace des octets opaques.
set -uo pipefail

APP_UUID="mqbmlz1bcwsdwi3t9fxsllqt"
AUDIT_UUID="wrunr6mwq2oxqq392i4myzjn"
APP_CT=$(docker ps --filter "name=${APP_UUID}" --format '{{.Names}}' | head -1)
SB_CT=$(docker ps --filter "name=sauvegarde-${AUDIT_UUID}" --format '{{.Names}}' | head -1)
[ -n "${APP_CT}" ] || { echo "❌ conteneur Axion-IA introuvable"; exit 1; }

env_ia()    { docker exec "${APP_CT}" printenv "$1" 2>/dev/null | tr -d '\n'; }
env_audit() { [ -n "${SB_CT}" ] && docker exec "${SB_CT}" printenv "$1" 2>/dev/null | tr -d '\n'; }

SB_HOST="${SB_HOST:-u595329.your-storagebox.de}"
SB_USER="${SB_USER:-u595329}"
SB_PORT="${SB_PORT:-23}"
# Le mot de passe est LU DANS UN FICHIER, jamais reçu en argument ni interpolé
# dans une commande. ⚠️ C'est une leçon payée : interpolé dans un `ssh "…"`,
# un seul caractère spécial le casse silencieusement et l'authentification
# échoue — j'ai perdu une demi-heure à croire à un blocage du fournisseur.
SB_SECRET="${SB_SECRET:-/opt/axion-ia/.storagebox-password}"
if [ ! -s "${SB_SECRET}" ]; then
  echo "❌ ${SB_SECRET} absent ou vide."
  echo "   Le déposer en 600 (il vient du .env de CRM Pro, variable SB_PASSWORD)."
  exit 1
fi
SB_PASSWORD=$(cat "${SB_SECRET}")

command -v sshpass >/dev/null 2>&1 || { echo "❌ sshpass manquant : apt install -y sshpass"; exit 1; }

WORK=$(mktemp -d /tmp/sbmirror.XXXXXX); chmod 700 "${WORK}"
trap 'rm -rf "${WORK}"' EXIT

sb() { sshpass -p "${SB_PASSWORD}" sftp -P "${SB_PORT}" \
        -o StrictHostKeyChecking=accept-new -o BatchMode=no -o ConnectTimeout=30 -b - \
        "${SB_USER}@${SB_HOST}"; }

# Un dossier par projet, pour ne jamais mélanger deux jeux de chiffrement.
printf 'mkdir /home/axion-ia-backups\nmkdir /home/axion-audit-backups-mirror\n' | sb >/dev/null 2>&1 || true

COPIES=0; ECHECS=0

miroir() {  # <etiquette> <bucket> <prefixe> <dest> <cle> <secret> <endpoint> [motif]
  local NOM="$1" BUCKET="$2" PREFIXE="$3" DEST="$4" AK="$5" SK="$6" EP="$7" MOTIF="${8:-.}"
  # ⚠️ Le motif n'est pas cosmétique : Axion Audit dépose SES DONNÉES et SON
  # COFFRE DE SECRETS dans le MÊME préfixe. Sans filtre, un tri par nom ne
  # rendrait que « secrets-… » (qui trie après « minio-… ») et la copie des
  # données manquerait, sans que rien ne le signale.
  local DERNIER
  DERNIER=$(docker run --rm --network=coolify \
    -e AWS_ACCESS_KEY_ID="$AK" -e AWS_SECRET_ACCESS_KEY="$SK" \
    -e AWS_REGION=auto -e AWS_PAGER="" amazon/aws-cli \
    --endpoint-url "$EP" s3 ls "s3://${BUCKET}/${PREFIXE}" 2>/dev/null \
    | awk '{print $4}' | grep -E "$MOTIF" | sort | tail -1)
  if [ -z "${DERNIER}" ]; then
    echo "  ⚪ ${NOM} : aucun objet sous ${PREFIXE}"
    return 0
  fi
  # Déjà présent ? On ne repaie pas le transfert pour rien.
  if printf 'ls -1 %s\n' "$DEST" | sb 2>/dev/null | grep -qxF "${DERNIER}"; then
    echo "  ✓ ${NOM} : ${DERNIER} déjà en place"
    return 0
  fi
  docker run --rm --network=coolify -v "${WORK}:/out" \
    -e AWS_ACCESS_KEY_ID="$AK" -e AWS_SECRET_ACCESS_KEY="$SK" \
    -e AWS_REGION=auto -e AWS_PAGER="" amazon/aws-cli \
    --endpoint-url "$EP" s3 cp "s3://${BUCKET}/${PREFIXE}${DERNIER}" "/out/${DERNIER}" >/dev/null 2>&1
  if [ ! -s "${WORK}/${DERNIER}" ]; then
    echo "  🔴 ${NOM} : téléchargement R2 échoué (${DERNIER})"; ECHECS=$((ECHECS+1)); return 0
  fi
  if printf 'put %s %s/\n' "${WORK}/${DERNIER}" "$DEST" | sb >/dev/null 2>&1; then
    echo "  🟢 ${NOM} : ${DERNIER} ($(du -h "${WORK}/${DERNIER}" | cut -f1))"
    COPIES=$((COPIES+1))
  else
    echo "  🔴 ${NOM} : envoi Storage Box échoué (${DERNIER})"; ECHECS=$((ECHECS+1))
  fi
  rm -f "${WORK}/${DERNIER}"
}

IA_AK=$(env_ia R2_ACCESS_KEY_ID); IA_SK=$(env_ia R2_SECRET_ACCESS_KEY)
IA_EP=$(env_ia R2_ENDPOINT);      IA_BK=$(env_ia R2_BUCKET_NAME)

echo "── Axion-IA ────────────────────────────────────────────────────────────"
for P in "base-horaire:postgres/hourly/" "base-quotidienne:postgres/daily/" \
         "fichiers:files/daily/" "docuseal:docuseal/daily/" "secrets:secrets/"; do
  miroir "${P%%:*}" "$IA_BK" "${P#*:}" /home/axion-ia-backups "$IA_AK" "$IA_SK" "$IA_EP"
done

if [ -n "${SB_CT}" ]; then
  AU_AK=$(env_audit BACKUP_R2_ACCESS_KEY); AU_SK=$(env_audit BACKUP_R2_SECRET_KEY)
  AU_EP=$(env_audit BACKUP_R2_ENDPOINT);   AU_BK=$(env_audit BACKUP_R2_BUCKET)
  echo "── Axion Audit ─────────────────────────────────────────────────────────"
  if [ -n "$AU_AK" ] && [ -n "$AU_BK" ]; then
    miroir "donnees" "$AU_BK" "staging/minio/" /home/axion-audit-backups-mirror \
      "$AU_AK" "$AU_SK" "$AU_EP" '^minio-.*[.]gpg$'
    miroir "coffre"  "$AU_BK" "staging/minio/" /home/axion-audit-backups-mirror \
      "$AU_AK" "$AU_SK" "$AU_EP" '^secrets-.*[.]coffre[.]gpg$'
    # `staging/pgbackrest/` n'est PAS recopié : c'est un dépôt pgbackrest, une
    # arborescence dont un fichier isolé ne vaut rien. Le miroir porte donc sur
    # les archives autonomes ; le PITR d'Axion Audit reste couvert par R2 seul —
    # dit ici pour que personne ne croie le contraire.
  else
    echo "  ⚪ identifiants R2 d'Axion Audit illisibles"
  fi
fi

echo ""
echo "Bilan : ${COPIES} copie(s), ${ECHECS} échec(s)"
[ "${ECHECS}" -eq 0 ] || exit 1
