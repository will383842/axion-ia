#!/usr/bin/env bash
# Vérifier qu'une migration Prisma est RÉELLEMENT appliquée en production.
#
# ## Pourquoi ce script existe
#
# `scripts/docker-entrypoint.sh` lance `prisma migrate deploy` en best-effort :
# si la commande échoue, il logue un WARNING et démarre Next.js quand même. Un
# job `deploy` vert et un `x-axion-build-sha` à jour prouvent que l'IMAGE est
# servie, jamais que le SCHÉMA a bougé. C'est l'incident du 2026-05-18 :
# migration avalée, application debout, drift invisible jusqu'au crash de la
# console admin. Cf. AGENTS.md, « Un déploiement vert ne prouve PAS que le
# schéma a bougé ».
#
# ## Ce qu'il fait, dans l'ordre
#
#   1. trouve le conteneur applicatif (celui qui porte les lignes d'entrypoint) ;
#   2. rapporte ce que l'entrypoint a dit de la migration ;
#   3. lit `prisma migrate status` (journal `_prisma_migrations`) ;
#   4. PREUVE DURE : un bloc DO qui LÈVE une exception si la migration n'est pas
#      enregistrée comme terminée, ou si l'une des colonnes attendues manque ;
#   5. TÉMOIN : rejoue le même mécanisme sur une table qui n'existe pas, pour
#      prouver qu'il SAIT échouer. Une preuve qu'on n'a jamais vue rougir ne
#      prouve rien.
#
# Tout est en LECTURE SEULE : aucune écriture, aucune migration déclenchée.
#
# ## Usage
#
#   scripts/ops/verifier-migration-en-prod.sh <nom_migration> [table | table.colonne | Type:valeur ...]
#
#   scripts/ops/verifier-migration-en-prod.sh 20260903120000_qualiopi_mission_formateur \
#     missions_formateur \
#     training_sessions.contact_sur_place_nom \
#     session_formateurs.rappel_j1_envoye_at
#
#   scripts/ops/verifier-migration-en-prod.sh 20260903160000_recrutement_statuts_enum \
#     JobApplicationStatus:interview JobApplicationStatus:offer JobApplicationStatus:withdrawn
#
# Un argument sans separateur est une TABLE dont on exige l'existence ; avec un
# POINT, une COLONNE de cette table ; avec DEUX-POINTS, une VALEUR d'un type
# enumere (`Type:valeur`).
#
# ⚠️ Les noms se lisent dans le DDL (`prisma/migrations/*/migration.sql`), JAMAIS
# dans `schema.prisma` : `@@map` fait diverger les deux en silence — l'enum
# Prisma `JobRejectionReason` cree le type `job_rejection_reason`, et le modele
# `Interview` cree la table `job_interviews`. Une sonde qui cherche le nom
# Prisma rend 0 sur une migration parfaitement appliquee.
#
# ⚠️ `migrate status` lit `_prisma_migrations`. Sur une base dont le schéma a été
# posé autrement, il annonce des migrations non appliquées alors que les tables
# sont là — d'où l'étape 4, qui interroge le schéma lui-même.
#
# Prérequis : accès SSH root au VPS (même clé que scripts/ops/*.sh).

set -uo pipefail

VPS_IP="${VPS_IP:-178.105.55.15}"
SSH_OPTS="-o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10"
SITE_URL="${SITE_URL:-https://axion-ia.com}"

MIGRATION="${1:-}"
if [ -z "$MIGRATION" ]; then
  echo "usage: $0 <nom_migration> [table | table.colonne | Type:valeur ...]" >&2
  exit 2
fi
shift

echo "── Version servie par la production ─────────────────────────────────────"
SHA=$(curl -sI "${SITE_URL}/fr" | tr -d '\r' | awk 'tolower($1)=="x-axion-build-sha:"{print $2}')
if [ -z "$SHA" ]; then
  echo "❌ en-tête x-axion-build-sha absent — la production ne répond pas comme prévu." >&2
  exit 1
fi
echo "   $SHA"

echo "── Conteneur applicatif ─────────────────────────────────────────────────"
# Le conteneur applicatif est celui dont l'image porte ce SHA ET qui a écrit des
# lignes d'entrypoint : il y en a DEUX qui portent le SHA, un seul migre.
CONTENEUR=$(ssh ${SSH_OPTS} root@"${VPS_IP}" "
  for c in \$(docker ps --format '{{.Names}}\t{{.Image}}' | grep '${SHA}' | cut -f1); do
    if docker logs \"\$c\" 2>&1 | grep -q '\\[entrypoint\\]'; then echo \"\$c\"; break; fi
  done" 2>/dev/null | tr -d '\r')
if [ -z "$CONTENEUR" ]; then
  echo "❌ aucun conteneur servant ${SHA} ne porte de lignes d'entrypoint." >&2
  echo "   La version servie n'est peut-être pas encore déployée sur ce VPS." >&2
  exit 1
fi
echo "   $CONTENEUR"

echo "── Ce que l'entrypoint a fait ───────────────────────────────────────────"
ssh ${SSH_OPTS} root@"${VPS_IP}" "docker logs '${CONTENEUR}' 2>&1 | grep -i 'entrypoint.*[Mm]igrat'" | sed 's/^/   /'

echo "── Journal des migrations (prisma migrate status) ───────────────────────"
ssh ${SSH_OPTS} root@"${VPS_IP}" \
  "docker exec '${CONTENEUR}' /app/prisma-cli/node_modules/.bin/prisma migrate status --schema=./prisma/schema.prisma 2>&1 | tail -4" \
  | sed 's/^/   /'

echo "── Preuve dure : le schéma porte-t-il vraiment ce qu'on attend ? ────────"
SQL="DO \$v\$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM \"_prisma_migrations\"
    WHERE migration_name='${MIGRATION}' AND finished_at IS NOT NULL;
  IF n = 0 THEN RAISE EXCEPTION 'ECHEC: migration ${MIGRATION} non enregistree comme terminee'; END IF;"
for cible in "$@"; do
  case "$cible" in
    *:*)
      # ── VALEUR D'ENUM — forme `Type:valeur` ────────────────────────────────
      #
      # 🔴 Une migration qui n'ajoute QU'UNE VALEUR D'ENUM ne crée ni table ni
      # colonne : `20260903160000_recrutement_statuts_enum` ne fait que trois
      # `ALTER TYPE … ADD VALUE IF NOT EXISTS`. Sans cette forme, ce script ne
      # pouvait rien exiger d'elle — « migration enregistrée » était tout ce
      # qu'on savait, c'est-à-dire le JOURNAL et pas le SCHÉMA.
      #
      # 🔑 LE NOM DU TYPE SE LIT DANS LE DDL, PAS DANS `schema.prisma`.
      # `@@map` fait diverger les deux **en silence, dans les deux sens** :
      # l'enum Prisma `JobRejectionReason` crée le type `job_rejection_reason`.
      # Une sonde qui cherche le nom Prisma rend 0 sur une migration
      # parfaitement appliquée — elle est vivante, elle vise la bonne base, et
      # elle pose la mauvaise question. Copier la chaîne du `.sql`.
      typeenum="${cible%%:*}"
      valeur="${cible#*:}"
      SQL="${SQL}
  SELECT count(*) INTO n FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname='${typeenum}' AND e.enumlabel='${valeur}';
  IF n = 0 THEN RAISE EXCEPTION 'ECHEC: valeur ${typeenum}:${valeur} ABSENTE de l enum'; END IF;"
      ;;
    *.*)
      table="${cible%%.*}"
      colonne="${cible#*.}"
      SQL="${SQL}
  SELECT count(*) INTO n FROM information_schema.columns
    WHERE table_name='${table}' AND column_name='${colonne}';
  IF n = 0 THEN RAISE EXCEPTION 'ECHEC: colonne ${table}.${colonne} ABSENTE'; END IF;"
      ;;
    *)
      SQL="${SQL}
  SELECT count(*) INTO n FROM information_schema.tables WHERE table_name='${cible}';
  IF n = 0 THEN RAISE EXCEPTION 'ECHEC: table ${cible} ABSENTE'; END IF;"
      ;;
  esac
done
SQL="${SQL}
END
\$v\$;"

if echo "$SQL" | ssh ${SSH_OPTS} root@"${VPS_IP}" \
    "docker exec -i '${CONTENEUR}' /app/prisma-cli/node_modules/.bin/prisma db execute --stdin --schema=./prisma/schema.prisma" \
    >/dev/null 2>&1; then
  echo "   ✅ migration enregistrée et objets présents"
else
  echo "   ❌ ÉCHEC — détail :"
  echo "$SQL" | ssh ${SSH_OPTS} root@"${VPS_IP}" \
    "docker exec -i '${CONTENEUR}' /app/prisma-cli/node_modules/.bin/prisma db execute --stdin --schema=./prisma/schema.prisma" 2>&1 \
    | grep -i "ECHEC\|ERROR" | sed 's/^/      /'
  echo "   Réparation : gh workflow run admin-emergency-migrate.yml -f action=migrate" >&2
  exit 1
fi

echo "── Témoin : la vérification sait-elle échouer ? ─────────────────────────"
TEMOIN="DO \$v\$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.tables WHERE table_name='table_qui_nexiste_pas_temoin';
  IF n = 0 THEN RAISE EXCEPTION 'TEMOIN: la verification sait echouer'; END IF;
END
\$v\$;"
if echo "$TEMOIN" | ssh ${SSH_OPTS} root@"${VPS_IP}" \
    "docker exec -i '${CONTENEUR}' /app/prisma-cli/node_modules/.bin/prisma db execute --stdin --schema=./prisma/schema.prisma" \
    >/dev/null 2>&1; then
  echo "   ❌ le témoin est PASSÉ : le mécanisme ne sait pas échouer, le ✅ ci-dessus ne vaut rien." >&2
  exit 1
fi
echo "   ✅ le témoin échoue comme prévu — le verdict ci-dessus est probant"
