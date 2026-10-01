-- ═════════════════════════════════════════════════════════════════════════════
-- Documents du projet dans le dossier client (ADR 0063, 2026-10-01).
--
-- ADDITIF UNIQUEMENT :
--   · cinq énumérations neuves ;
--   · quatre VALEURS ajoutées à `projet_evenement_action` (le journal du
--     projet, réutilisé : ajout, archivage, réaffichage, téléchargement) ;
--   · une colonne NULLABLE `projet_evenements.document_id` (sans clé
--     étrangère : le journal survit à tout) ;
--   · trois tables neuves, `documents_projet` (métadonnées),
--     `documents_projet_contenus` (octets du fichier, `bytea`, à part pour
--     qu'aucune liste ne les charge) et `documents_projet_ouvertures`
--     (journal en ajout seul des ouvertures du lien public d'une page) ;
--   · leur SQL brut (CHECK, clé composée, triggers), déclaré dans
--     `src/features/dossier-client/documents/objets-sql.ts`.
-- AUCUN DROP, AUCUN renommage, AUCUNE colonne modifiée, AUCUNE reprise de
-- données. Aucune ligne existante n'est lue ni écrite.
--
-- ## Fenêtre app/worker (~50 min, le worker atterrit avant l'app qui migre)
--
-- Le worker ne lit ni n'écrit ces tables. La route publique
-- `/document/<id>/<jeton>` n'existe que dans l'image N : aucun lien n'est
-- émis avant elle. Seul risque : un conteneur d'app
-- N-1 encore debout APRÈS la migration lirait, dans l'historique d'un projet,
-- une valeur `document_*` que son client Prisma ne connaît pas — impossible
-- tant qu'aucun document n'a été ajouté, et aucun ne peut l'être avant que
-- l'app N serve la page. Accepté (ADR 0063, D9).
--
-- ## Valeurs d'énumération et transaction
--
-- `ALTER TYPE … ADD VALUE` est admis dans une transaction depuis
-- PostgreSQL 12 (production : 16) ; les valeurs ne sont pas UTILISÉES dans
-- cette migration (aucune reprise), ce qui serait refusé.
--
-- Structure du fichier :
--   1. partie Prisma — identique à `prisma migrate diff` (schéma de `main` →
--      schéma de cette branche) ;
--   2. SQL brut — chaque objet déclaré dans
--      `src/features/dossier-client/documents/objets-sql.ts`, confronté à
--      `pg_constraint` / `pg_trigger` sur base neuve (Gate D).
--
-- ── RÉVERSION (à n'exécuter qu'à la main, sur décision, APRÈS sauvegarde
--    vérifiée : elle DÉTRUIT les documents — ordre permanent : ne jamais
--    purger. Les valeurs d'énumération ajoutées ne se retirent pas.) ─────────
-- BEGIN;
-- DROP TABLE IF EXISTS "documents_projet_ouvertures", "documents_projet_contenus", "documents_projet";
-- DROP FUNCTION IF EXISTS "documents_projet_garde"();
-- DROP FUNCTION IF EXISTS "documents_projet_contenus_garde"();
-- DROP FUNCTION IF EXISTS "documents_projet_refus_truncate"();
-- DROP FUNCTION IF EXISTS "documents_projet_verifier_contenu"();
-- DROP FUNCTION IF EXISTS "documents_projet_contenu_a_un_fichier"();
-- DROP FUNCTION IF EXISTS "documents_projet_ouvertures_ajout_seul"();
-- DROP TYPE IF EXISTS "origine_ouverture_document", "analyse_antivirus_document", "format_fichier_document",
--   "nature_document_projet", "cote_document_projet";
-- ALTER TABLE "projet_evenements" DROP COLUMN IF EXISTS "document_id";
-- COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

-- ═══ 1. PARTIE PRISMA ════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "cote_document_projet" AS ENUM ('envoye_au_client', 'interne');

-- CreateEnum
CREATE TYPE "nature_document_projet" AS ENUM ('email', 'pdf', 'page_en_ligne', 'compte_rendu', 'devis', 'note', 'autre');

-- CreateEnum
CREATE TYPE "format_fichier_document" AS ENUM ('pdf', 'html', 'eml', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'txt', 'md', 'csv');

-- CreateEnum
CREATE TYPE "analyse_antivirus_document" AS ENUM ('non_analyse', 'sain', 'infecte');

-- CreateEnum
CREATE TYPE "origine_ouverture_document" AS ENUM ('navigateur', 'apercu_automatique');

-- AlterEnum
ALTER TYPE "projet_evenement_action" ADD VALUE 'document_ajoute';
ALTER TYPE "projet_evenement_action" ADD VALUE 'document_archive';
ALTER TYPE "projet_evenement_action" ADD VALUE 'document_reaffiche';
ALTER TYPE "projet_evenement_action" ADD VALUE 'document_telecharge';

-- AlterTable
ALTER TABLE "projet_evenements" ADD COLUMN     "document_id" UUID;

-- CreateTable
CREATE TABLE "documents_projet" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "projet_id" UUID NOT NULL,
    "cote" "cote_document_projet" NOT NULL,
    "nature" "nature_document_projet" NOT NULL,
    "titre" VARCHAR(200) NOT NULL,
    "envoye_le" DATE,
    "lien_url" VARCHAR(2000),
    "fichier_nom" VARCHAR(255),
    "fichier_format" "format_fichier_document",
    "fichier_taille_octets" INTEGER,
    "fichier_sha256" CHAR(64),
    "analyse_antivirus" "analyse_antivirus_document",
    "analyse_le" TIMESTAMP(3),
    "analyse_signature" VARCHAR(200),
    "archive_le" TIMESTAMP(3),
    "archive_par_id" UUID,
    "ajoute_par_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_projet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_projet_contenus" (
    "document_id" UUID NOT NULL,
    "octets" BYTEA NOT NULL,

    CONSTRAINT "documents_projet_contenus_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "documents_projet_ouvertures" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "origine" "origine_ouverture_document" NOT NULL,
    "ouvert_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_projet_ouvertures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_projet_projet_id_archive_le_idx" ON "documents_projet"("projet_id", "archive_le");

-- CreateIndex
CREATE INDEX "documents_projet_client_id_projet_id_idx" ON "documents_projet"("client_id", "projet_id");

-- CreateIndex
CREATE INDEX "documents_projet_ouvertures_document_id_ouvert_le_idx" ON "documents_projet_ouvertures"("document_id", "ouvert_le");

-- AddForeignKey
ALTER TABLE "documents_projet_contenus" ADD CONSTRAINT "documents_projet_contenus_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents_projet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══ 2. SQL BRUT ═════════════════════════════════════════════════════════════
--
-- Chaque objet ci-dessous est déclaré dans
-- `src/features/dossier-client/documents/objets-sql.ts`. Codes d'erreur
-- propres au chantier : AXD01 (suppression), AXD02 (réécriture), AXD03
-- (contenu non conforme).

-- ── Clé composée : le projet est du MÊME client ──────────────────────────────
--
-- Cible : l'index unique `projets(id, client_id)` (déjà posé par Prisma,
-- `@@unique([id, clientId])`). ON UPDATE CASCADE : une fusion de fiches qui
-- déplace le projet emporte ses documents ; « Défaire » les ramène. ON DELETE
-- RESTRICT : un projet qui porte des documents ne se supprime pas.
-- DEFERRABLE INITIALLY IMMEDIATE, comme toute clé `_meme_client` (fusion A3).
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_projet_meme_client" FOREIGN KEY ("projet_id", "client_id") REFERENCES "projets"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- ── CHECK ────────────────────────────────────────────────────────────────────

-- Un titre lisible.
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_titre_non_vide" CHECK (char_length(btrim("titre")) >= 1);

-- EXACTEMENT un de lien / fichier ; un fichier porte ses cinq colonnes ensemble
-- (nom, format, taille, empreinte, verdict) ; un lien n'en porte aucune.
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_lien_ou_fichier" CHECK (("lien_url" IS NOT NULL AND "fichier_nom" IS NULL AND "fichier_format" IS NULL AND "fichier_taille_octets" IS NULL AND "fichier_sha256" IS NULL AND "analyse_antivirus" IS NULL AND "analyse_le" IS NULL AND "analyse_signature" IS NULL) OR ("lien_url" IS NULL AND "fichier_nom" IS NOT NULL AND "fichier_format" IS NOT NULL AND "fichier_taille_octets" IS NOT NULL AND "fichier_sha256" IS NOT NULL AND "analyse_antivirus" IS NOT NULL));

-- Lien : https seulement, un hôte sans identifiants (`user:mdp@`), aucun
-- espace ni caractère de contrôle.
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_lien_https" CHECK ("lien_url" IS NULL OR "lien_url" ~ '^https://[^/?#@[:space:][:cntrl:]]+([/?#][^[:space:][:cntrl:]]*)?$');

-- Fichier : 1 octet à 15 Mo (15 × 1024 × 1024). Même borne que
-- `TAILLE_MAX_FICHIER_OCTETS` (formats.ts) — garde de texte.
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_fichier_taille" CHECK ("fichier_taille_octets" IS NULL OR "fichier_taille_octets" BETWEEN 1 AND 15728640);

-- Empreinte SHA-256 en hexadécimal minuscule.
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_fichier_sha256" CHECK ("fichier_sha256" IS NULL OR "fichier_sha256" ~ '^[0-9a-f]{64}$');

-- Nom de fichier : non vide, sans séparateur de chemin ni caractère de contrôle.
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_fichier_nom" CHECK ("fichier_nom" IS NULL OR (char_length(btrim("fichier_nom")) >= 1 AND "fichier_nom" !~ '[/\\[:cntrl:]]'));

-- « Envoyé au client » porte sa date d'envoi ; « interne » n'en porte pas.
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_date_envoi" CHECK (("cote" = 'envoye_au_client') = ("envoye_le" IS NOT NULL));

-- Qui a archivé n'existe que si c'est archivé (la machine archive sans auteur).
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_archive_coherent" CHECK ("archive_par_id" IS NULL OR "archive_le" IS NOT NULL);

-- Un verdict (sain, infecté) est daté ; seule une infection porte une signature.
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_verdict_coherent" CHECK (("analyse_antivirus" IS NULL OR "analyse_antivirus" = 'non_analyse' OR "analyse_le" IS NOT NULL) AND ("analyse_signature" IS NULL OR "analyse_antivirus" = 'infecte'));

-- Un fichier infecté reste archivé : il ne se réaffiche pas.
ALTER TABLE "documents_projet" ADD CONSTRAINT "documents_projet_infecte_archive" CHECK ("analyse_antivirus" IS DISTINCT FROM 'infecte' OR "archive_le" IS NOT NULL);

-- Les octets : 1 octet à 15 Mo.
ALTER TABLE "documents_projet_contenus" ADD CONSTRAINT "documents_projet_contenus_taille" CHECK (octet_length("octets") BETWEEN 1 AND 15728640);

-- ── Triggers ─────────────────────────────────────────────────────────────────

-- Un document ne se supprime JAMAIS (ordre permanent : ne rien purger) et ne
-- se réécrit pas : une nouvelle version est un nouveau document. Ne changent
-- que l'archivage, le verdict antivirus (une seule fois, depuis
-- `non_analyse`) et `client_id` (cascade d'une fusion de fiches, contrôlée par
-- la clé composée). Exception unique : le drapeau de session
-- `axion.effacement_rgpd`, posé en `SET LOCAL` par `src/lib/rgpd-erase.ts`
-- SEUL — comme pour les faits et les preuves d'accord.
CREATE FUNCTION "documents_projet_garde"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  modifiables CONSTANT text[] := ARRAY[
    'archive_le', 'archive_par_id', 'analyse_antivirus', 'analyse_le', 'analyse_signature',
    'client_id'
  ];
BEGIN
  IF current_setting('axion.effacement_rgpd', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'documents_projet : un document ne se supprime pas (archivez-le)'
      USING ERRCODE = 'AXD01';
  END IF;
  IF (to_jsonb(NEW) - modifiables) IS DISTINCT FROM (to_jsonb(OLD) - modifiables) THEN
    RAISE EXCEPTION 'documents_projet : un document ne se réécrit pas (une nouvelle version est un nouveau document)'
      USING ERRCODE = 'AXD02';
  END IF;
  IF OLD."analyse_antivirus" IN ('sain', 'infecte')
     AND (NEW."analyse_antivirus", NEW."analyse_le", NEW."analyse_signature")
         IS DISTINCT FROM (OLD."analyse_antivirus", OLD."analyse_le", OLD."analyse_signature") THEN
    RAISE EXCEPTION 'documents_projet : un verdict antivirus rendu ne change plus'
      USING ERRCODE = 'AXD02';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "documents_projet_immuable" BEFORE UPDATE OR DELETE ON "documents_projet"
  FOR EACH ROW EXECUTE FUNCTION "documents_projet_garde"();

-- Les octets ne se modifient ni ne se suppriment (même exception RGPD).
CREATE FUNCTION "documents_projet_contenus_garde"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('axion.effacement_rgpd', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'documents_projet_contenus : le contenu d''un fichier ne se modifie ni ne se supprime'
    USING ERRCODE = 'AXD01';
END
$$;

CREATE TRIGGER "documents_projet_contenus_immuable" BEFORE UPDATE OR DELETE ON "documents_projet_contenus"
  FOR EACH ROW EXECUTE FUNCTION "documents_projet_contenus_garde"();

-- TRUNCATE contourne les triggers de ligne : refusé sur les deux tables.
CREATE FUNCTION "documents_projet_refus_truncate"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% : TRUNCATE refusé (aucune suppression de documents)', TG_TABLE_NAME
    USING ERRCODE = 'AXD01';
END
$$;

CREATE TRIGGER "documents_projet_pas_de_truncate" BEFORE TRUNCATE ON "documents_projet"
  FOR EACH STATEMENT EXECUTE FUNCTION "documents_projet_refus_truncate"();

CREATE TRIGGER "documents_projet_contenus_pas_de_truncate" BEFORE TRUNCATE ON "documents_projet_contenus"
  FOR EACH STATEMENT EXECUTE FUNCTION "documents_projet_refus_truncate"();

-- En fin de transaction : un document FICHIER a son contenu, de la taille et
-- de l'empreinte déclarées (recalculées par la base) ; un document LIEN n'en a
-- pas. La ligne est RELUE (l'image de l'événement peut être antérieure).
CREATE FUNCTION "documents_projet_verifier_contenu"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  d RECORD;
  taille integer;
  empreinte text;
BEGIN
  SELECT "lien_url", "fichier_taille_octets", "fichier_sha256" INTO d
    FROM "documents_projet" WHERE "id" = NEW."id";
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT octet_length(c."octets"), encode(sha256(c."octets"), 'hex') INTO taille, empreinte
    FROM "documents_projet_contenus" c WHERE c."document_id" = NEW."id";
  IF d."lien_url" IS NOT NULL THEN
    IF taille IS NOT NULL THEN
      RAISE EXCEPTION 'documents_projet : un lien n''a pas de contenu' USING ERRCODE = 'AXD03';
    END IF;
    RETURN NULL;
  END IF;
  IF taille IS NULL THEN
    RAISE EXCEPTION 'documents_projet : un fichier sans contenu' USING ERRCODE = 'AXD03';
  END IF;
  IF taille <> d."fichier_taille_octets" OR empreinte <> d."fichier_sha256" THEN
    RAISE EXCEPTION 'documents_projet : le contenu ne correspond pas à la taille ou à l''empreinte déclarées'
      USING ERRCODE = 'AXD03';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "documents_projet_contenu_conforme"
  AFTER INSERT ON "documents_projet"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "documents_projet_verifier_contenu"();

-- Symétrique : un contenu n'appartient qu'à un document FICHIER.
CREATE FUNCTION "documents_projet_contenu_a_un_fichier"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "documents_projet" d
    WHERE d."id" = NEW."document_id" AND d."fichier_sha256" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'documents_projet_contenus : un contenu appartient à un document fichier'
      USING ERRCODE = 'AXD03';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "documents_projet_contenus_d_un_fichier"
  AFTER INSERT ON "documents_projet_contenus"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "documents_projet_contenu_a_un_fichier"();

-- Journal des ouvertures du lien public : ajout seul, SANS exception — pas
-- même sous le drapeau d'effacement (il ne porte ni IP, ni navigateur, ni
-- personne ; même doctrine que `visio_journal_ajout_seul`).
CREATE FUNCTION "documents_projet_ouvertures_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% : journal en ajout seul (ni modification ni suppression)', TG_TABLE_NAME
    USING ERRCODE = 'AXD01';
END
$$;

CREATE TRIGGER "documents_projet_ouvertures_ajout_seul" BEFORE UPDATE OR DELETE ON "documents_projet_ouvertures"
  FOR EACH ROW EXECUTE FUNCTION "documents_projet_ouvertures_ajout_seul"();

CREATE TRIGGER "documents_projet_ouvertures_pas_de_truncate" BEFORE TRUNCATE ON "documents_projet_ouvertures"
  FOR EACH STATEMENT EXECUTE FUNCTION "documents_projet_refus_truncate"();
