-- ═════════════════════════════════════════════════════════════════════════════
-- Candidatures unifiées, lot L4 — fichiers partagés et bibliothèque
-- (ADR 0065, 2026-10-07).
--
-- ADDITIF UNIQUEMENT :
--   · six énumérations neuves ;
--   · quatre tables neuves : `fichiers_partages` (métadonnées ; les octets
--     sont dans R2, compartiment dédié), `liens_partage` (un lien privé par
--     personne, créé à partir de L5), `liens_partage_fichiers` (les fichiers
--     d'un lien) et `liens_partage_acces` (journal des accès, ajout seul,
--     SANS clé étrangère) ;
--   · deux clés étrangères NOUVELLES vers `job_applications` et `submissions`
--     (ON DELETE CASCADE) : elles ne touchent aucune ligne existante ;
--   · leur SQL brut (CHECK, triggers), déclaré dans
--     `src/server/partages/objets-sql.ts`.
-- AUCUN DROP, AUCUN renommage, AUCUNE colonne existante modifiée, AUCUNE
-- reprise de données. Aucune ligne existante n'est lue ni écrite.
--
-- ## Fenêtre app/worker (~50 min, le worker atterrit avant l'app qui migre)
--
-- Le worker porte la tâche d'antivirus de ces fichiers. Pendant la fenêtre où
-- la table n'existe pas encore, la tâche s'arrête sans lever (erreur Prisma
-- P2021 interceptée) — et elle ne tourne de toute façon que si
-- `R2_PARTAGES_BUCKET_NAME` est posé. Aucun fichier ne peut exister avant que
-- l'app N serve la page de dépôt.
--
-- ## Aucun effacement automatique (ordre de Will, 07/10)
--
-- `fichiers_partages` refuse la suppression (trigger) ; seul l'effacement
-- RGPD manuel (drapeau `axion.effacement_rgpd`, posé par `rgpd-erase.ts`)
-- passe. `liens_partage` n'a PAS de trigger anti-suppression [B1] : la
-- cascade d'un effacement manuel de dossier doit l'emporter. Le journal des
-- accès n'a pas de clé étrangère : il survit sans bloquer.
--
-- Structure du fichier :
--   1. partie Prisma — identique à `prisma migrate diff` (schéma de `main` →
--      schéma de cette branche) ;
--   2. SQL brut — chaque objet déclaré dans `src/server/partages/objets-sql.ts`,
--      confronté à `pg_constraint` / `pg_trigger` sur base neuve (Gate D,
--      `tests/integration/partages/`).
--
-- ── RÉVERSION (à n'exécuter qu'à la main, sur décision, APRÈS sauvegarde
--    vérifiée : elle DÉTRUIT les métadonnées des fichiers — ordre permanent :
--    ne jamais purger. Les objets R2 ne sont pas touchés.) ───────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS "liens_partage_acces", "liens_partage_fichiers", "liens_partage", "fichiers_partages";
-- DROP FUNCTION IF EXISTS "fichiers_partages_garde"();
-- DROP FUNCTION IF EXISTS "partages_refus_truncate"();
-- DROP FUNCTION IF EXISTS "liens_partage_garde"();
-- DROP FUNCTION IF EXISTS "liens_partage_fichiers_garde"();
-- DROP FUNCTION IF EXISTS "liens_partage_acces_garde"();
-- DROP TYPE IF EXISTS "type_acces_partage", "analyse_fichier_partage", "etat_depot_fichier",
--   "categorie_fichier_partage", "origine_fichier_partage", "nature_fichier_partage";
-- COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

-- ═══ 1. PARTIE PRISMA ════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "nature_fichier_partage" AS ENUM ('fichier', 'lien_externe');

-- CreateEnum
CREATE TYPE "origine_fichier_partage" AS ENUM ('equipe', 'personne');

-- CreateEnum
CREATE TYPE "categorie_fichier_partage" AS ENUM ('lut', 'video_exemple', 'rushs', 'consignes', 'musique', 'kit_apporteur', 'presentation', 'essai_rendu', 'autre');

-- CreateEnum
CREATE TYPE "etat_depot_fichier" AS ENUM ('en_cours', 'disponible', 'abandonne');

-- CreateEnum
CREATE TYPE "analyse_fichier_partage" AS ENUM ('en_attente', 'sain', 'infecte', 'hors_limite');

-- CreateEnum
CREATE TYPE "type_acces_partage" AS ENUM ('page_ouverte', 'telechargement');

-- CreateTable
CREATE TABLE "fichiers_partages" (
    "id" UUID NOT NULL,
    "titre" VARCHAR(200) NOT NULL,
    "nature" "nature_fichier_partage" NOT NULL,
    "origine" "origine_fichier_partage" NOT NULL DEFAULT 'equipe',
    "categorie" "categorie_fichier_partage" NOT NULL,
    "dans_bibliotheque" BOOLEAN NOT NULL DEFAULT false,
    "nom_fichier" VARCHAR(255),
    "taille_octets" BIGINT,
    "type_mime" VARCHAR(150),
    "r2_cle" VARCHAR(400),
    "r2_upload_id" VARCHAR(1024),
    "etat_depot" "etat_depot_fichier" NOT NULL,
    "disponible_le" TIMESTAMP(3),
    "analyse_antivirus" "analyse_fichier_partage",
    "analyse_le" TIMESTAMP(3),
    "analyse_signature" VARCHAR(200),
    "url_externe" VARCHAR(2000),
    "depose_par_id" UUID,
    "depose_par_nom" VARCHAR(200) NOT NULL,
    "lien_depot_id" UUID,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archive_le" TIMESTAMP(3),
    "archive_par_id" UUID,

    CONSTRAINT "fichiers_partages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liens_partage" (
    "id" UUID NOT NULL,
    "application_id" UUID,
    "submission_id" UUID,
    "reponse_id" VARCHAR(40),
    "depot_autorise" BOOLEAN NOT NULL DEFAULT false,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "revoque_le" TIMESTAMP(3),
    "motif_retrait" VARCHAR(200),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par_id" UUID,
    "cree_par_nom" VARCHAR(200) NOT NULL,

    CONSTRAINT "liens_partage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liens_partage_fichiers" (
    "lien_id" UUID NOT NULL,
    "fichier_id" UUID NOT NULL,

    CONSTRAINT "liens_partage_fichiers_pkey" PRIMARY KEY ("lien_id","fichier_id")
);

-- CreateTable
CREATE TABLE "liens_partage_acces" (
    "id" UUID NOT NULL,
    "lien_id" UUID NOT NULL,
    "fichier_id" UUID,
    "type" "type_acces_partage" NOT NULL,
    "origine" "origine_ouverture_document" NOT NULL,
    "survenu_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liens_partage_acces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fichiers_partages_r2_cle_key" ON "fichiers_partages"("r2_cle");

-- CreateIndex
CREATE INDEX "fichiers_partages_dans_bibliotheque_archive_le_idx" ON "fichiers_partages"("dans_bibliotheque", "archive_le");

-- CreateIndex
CREATE INDEX "fichiers_partages_etat_depot_analyse_antivirus_idx" ON "fichiers_partages"("etat_depot", "analyse_antivirus");

-- CreateIndex
CREATE INDEX "fichiers_partages_lien_depot_id_idx" ON "fichiers_partages"("lien_depot_id");

-- CreateIndex
CREATE INDEX "liens_partage_application_id_idx" ON "liens_partage"("application_id");

-- CreateIndex
CREATE INDEX "liens_partage_submission_id_idx" ON "liens_partage"("submission_id");

-- CreateIndex
CREATE INDEX "liens_partage_fichiers_fichier_id_idx" ON "liens_partage_fichiers"("fichier_id");

-- CreateIndex
CREATE INDEX "liens_partage_acces_lien_id_survenu_le_idx" ON "liens_partage_acces"("lien_id", "survenu_le");

-- CreateIndex
CREATE INDEX "liens_partage_acces_fichier_id_idx" ON "liens_partage_acces"("fichier_id");

-- AddForeignKey
ALTER TABLE "liens_partage" ADD CONSTRAINT "liens_partage_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liens_partage" ADD CONSTRAINT "liens_partage_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liens_partage_fichiers" ADD CONSTRAINT "liens_partage_fichiers_lien_id_fkey" FOREIGN KEY ("lien_id") REFERENCES "liens_partage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liens_partage_fichiers" ADD CONSTRAINT "liens_partage_fichiers_fichier_id_fkey" FOREIGN KEY ("fichier_id") REFERENCES "fichiers_partages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══ 2. SQL BRUT ═════════════════════════════════════════════════════════════
--
-- Chaque objet ci-dessous est déclaré dans `src/server/partages/objets-sql.ts`.
-- Codes d'erreur propres au chantier : AXP01 (suppression), AXP02
-- (réécriture), AXP03 (journal en ajout seul).

-- ── CHECK — fichiers_partages ────────────────────────────────────────────────

-- Un titre lisible.
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_titre_non_vide" CHECK (char_length(btrim("titre")) >= 1);

-- Un fichier R2 porte sa clé, son nom, sa taille et un état d'analyse, et pas
-- d'URL ; un lien externe porte son URL et RIEN d'un fichier, il est
-- disponible d'emblée et vient toujours de l'équipe.
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_nature_coherente" CHECK (("nature" = 'fichier' AND "r2_cle" IS NOT NULL AND "nom_fichier" IS NOT NULL AND "taille_octets" IS NOT NULL AND "analyse_antivirus" IS NOT NULL AND "url_externe" IS NULL) OR ("nature" = 'lien_externe' AND "url_externe" IS NOT NULL AND "r2_cle" IS NULL AND "r2_upload_id" IS NULL AND "nom_fichier" IS NULL AND "taille_octets" IS NULL AND "type_mime" IS NULL AND "analyse_antivirus" IS NULL AND "analyse_le" IS NULL AND "analyse_signature" IS NULL AND "etat_depot" = 'disponible' AND "origine" = 'equipe'));

-- Lien externe : https seulement, un hôte sans identifiants (`user:mdp@`),
-- aucun espace ni caractère de contrôle (même règle que `documents_projet`).
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_url_https" CHECK ("url_externe" IS NULL OR "url_externe" ~ '^https://[^/?#@[:space:][:cntrl:]]+([/?#][^[:space:][:cntrl:]]*)?$');

-- La clé R2 est choisie par le serveur : `partages/<id de la ligne>/<nom ascii>`.
-- Liée à l'identifiant : deux lignes ne peuvent pas désigner le même objet,
-- et aucune ne peut viser une clé hors du préfixe (sauvegardes, documents).
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_r2_cle_prefixe" CHECK ("r2_cle" IS NULL OR (left("r2_cle", 46) = 'partages/' || "id"::text || '/' AND "r2_cle" ~ '^partages/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,200}$'));

-- Taille : 1 octet à 20 Gio pour l'équipe (21 474 836 480), 4 Gio pour un
-- fichier renvoyé par une personne (4 294 967 296), limite de l'antivirus.
-- Mêmes bornes que `TAILLE_MAX_EQUIPE_OCTETS` / `TAILLE_MAX_PERSONNE_OCTETS`
-- (`src/server/partages/regles.ts`) — garde de texte.
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_taille" CHECK ("taille_octets" IS NULL OR ("taille_octets" >= 1 AND "taille_octets" <= CASE WHEN "origine" = 'personne' THEN 4294967296 ELSE 21474836480 END));

-- Nom de fichier : non vide, sans séparateur de chemin ni caractère de contrôle.
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_nom_fichier" CHECK ("nom_fichier" IS NULL OR (char_length(btrim("nom_fichier")) >= 1 AND "nom_fichier" !~ '[/\\[:cntrl:]]'));

-- Un fichier renvoyé par une personne vient d'un lien (L5b), et seulement lui.
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_origine_personne" CHECK (("origine" = 'personne') = ("lien_depot_id" IS NOT NULL));

-- Un envoi en cours a son identifiant d'envoi R2 ; une date de mise à
-- disposition n'existe que pour un fichier disponible.
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_depot_coherent" CHECK (("etat_depot" <> 'en_cours' OR "r2_upload_id" IS NOT NULL) AND ("disponible_le" IS NULL OR "etat_depot" = 'disponible'));

-- Un verdict (sain, infecté) est daté ; seule une infection porte une signature.
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_verdict_coherent" CHECK (("analyse_antivirus" IS NULL OR "analyse_antivirus" IN ('en_attente', 'hors_limite') OR "analyse_le" IS NOT NULL) AND ("analyse_signature" IS NULL OR "analyse_antivirus" = 'infecte'));

-- « Non analysé » n'existe que pour un fichier de l'ÉQUIPE de plus de 200 Mio
-- (209 715 200) : un fichier venu de l'extérieur est TOUJOURS analysé (D7).
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_hors_limite_equipe" CHECK ("analyse_antivirus" IS DISTINCT FROM 'hors_limite' OR ("origine" = 'equipe' AND "taille_octets" > 209715200));

-- Un fichier infecté reste archivé : il ne se réaffiche pas.
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_infecte_archive" CHECK ("analyse_antivirus" IS DISTINCT FROM 'infecte' OR "archive_le" IS NOT NULL);

-- Qui a archivé n'existe que si c'est archivé (la machine archive sans auteur).
ALTER TABLE "fichiers_partages" ADD CONSTRAINT "fichiers_partages_archive_coherent" CHECK ("archive_par_id" IS NULL OR "archive_le" IS NOT NULL);

-- ── CHECK — liens_partage ────────────────────────────────────────────────────

-- Un lien vise UNE personne : un candidat OU un futur apporteur, jamais les deux.
ALTER TABLE "liens_partage" ADD CONSTRAINT "liens_partage_une_personne" CHECK (num_nonnulls("application_id", "submission_id") = 1);

-- Un motif de retrait n'existe que pour un lien retiré.
ALTER TABLE "liens_partage" ADD CONSTRAINT "liens_partage_retrait_coherent" CHECK ("motif_retrait" IS NULL OR "revoque_le" IS NOT NULL);

-- ── Triggers ─────────────────────────────────────────────────────────────────

-- Un fichier ne se supprime JAMAIS (ordre permanent : ne rien purger) et ne se
-- réécrit pas. Ne changent que l'état du dépôt (depuis `en_cours` seulement),
-- la date de mise à disposition, le verdict antivirus (une seule fois, depuis
-- `en_attente`), la présence dans la bibliothèque et l'archivage. Exception
-- unique : le drapeau de session `axion.effacement_rgpd`, posé en `SET LOCAL`
-- par `src/lib/rgpd-erase.ts` SEUL — comme pour les documents du projet.
CREATE FUNCTION "fichiers_partages_garde"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  modifiables CONSTANT text[] := ARRAY[
    'etat_depot', 'disponible_le', 'analyse_antivirus', 'analyse_le', 'analyse_signature',
    'dans_bibliotheque', 'archive_le', 'archive_par_id'
  ];
BEGIN
  IF current_setting('axion.effacement_rgpd', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'fichiers_partages : un fichier ne se supprime pas (archivez-le)'
      USING ERRCODE = 'AXP01';
  END IF;
  IF (to_jsonb(NEW) - modifiables) IS DISTINCT FROM (to_jsonb(OLD) - modifiables) THEN
    RAISE EXCEPTION 'fichiers_partages : un fichier ne se réécrit pas (un autre fichier est une autre ligne)'
      USING ERRCODE = 'AXP02';
  END IF;
  IF OLD."etat_depot" <> 'en_cours' AND NEW."etat_depot" IS DISTINCT FROM OLD."etat_depot" THEN
    RAISE EXCEPTION 'fichiers_partages : un dépôt terminé ou abandonné ne change plus d''état'
      USING ERRCODE = 'AXP02';
  END IF;
  IF OLD."analyse_antivirus" IS NOT NULL AND OLD."analyse_antivirus" <> 'en_attente'
     AND (NEW."analyse_antivirus", NEW."analyse_le", NEW."analyse_signature")
         IS DISTINCT FROM (OLD."analyse_antivirus", OLD."analyse_le", OLD."analyse_signature") THEN
    RAISE EXCEPTION 'fichiers_partages : un verdict antivirus rendu ne change plus'
      USING ERRCODE = 'AXP02';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "fichiers_partages_immuable" BEFORE UPDATE OR DELETE ON "fichiers_partages"
  FOR EACH ROW EXECUTE FUNCTION "fichiers_partages_garde"();

-- TRUNCATE refusé (fichiers et journal des accès).
CREATE FUNCTION "partages_refus_truncate"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% : TRUNCATE refusé', TG_TABLE_NAME USING ERRCODE = 'AXP01';
END
$$;

CREATE TRIGGER "fichiers_partages_pas_de_truncate" BEFORE TRUNCATE ON "fichiers_partages"
  FOR EACH STATEMENT EXECUTE FUNCTION "partages_refus_truncate"();

-- Un lien ne se réécrit pas : seules sa date limite (prolonger) et son
-- retrait (date, motif) changent, et un lien retiré le reste. PAS de refus de
-- suppression [B1] : la cascade d'un effacement manuel de dossier passe.
CREATE FUNCTION "liens_partage_garde"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  modifiables CONSTANT text[] := ARRAY['expire_le', 'revoque_le', 'motif_retrait'];
BEGIN
  IF (to_jsonb(NEW) - modifiables) IS DISTINCT FROM (to_jsonb(OLD) - modifiables) THEN
    RAISE EXCEPTION 'liens_partage : un lien ne se réécrit pas (prolonger ou retirer seulement)'
      USING ERRCODE = 'AXP02';
  END IF;
  IF OLD."revoque_le" IS NOT NULL AND NEW."revoque_le" IS DISTINCT FROM OLD."revoque_le" THEN
    RAISE EXCEPTION 'liens_partage : un lien retiré le reste (envoyez-en un nouveau)'
      USING ERRCODE = 'AXP02';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "liens_partage_reecriture_limitee" BEFORE UPDATE ON "liens_partage"
  FOR EACH ROW EXECUTE FUNCTION "liens_partage_garde"();

-- Les fichiers d'un lien ne changent pas après l'envoi (la suppression, elle,
-- suit la cascade du lien).
CREATE FUNCTION "liens_partage_fichiers_garde"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'liens_partage_fichiers : les fichiers d''un lien envoyé ne changent pas'
    USING ERRCODE = 'AXP02';
END
$$;

CREATE TRIGGER "liens_partage_fichiers_immuable" BEFORE UPDATE ON "liens_partage_fichiers"
  FOR EACH ROW EXECUTE FUNCTION "liens_partage_fichiers_garde"();

-- Journal des accès : ajout seul, ni UPDATE ni DELETE, même sous le drapeau
-- d'effacement (il ne porte rien sur la personne).
CREATE FUNCTION "liens_partage_acces_garde"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'liens_partage_acces : journal en ajout seul'
    USING ERRCODE = 'AXP03';
END
$$;

CREATE TRIGGER "liens_partage_acces_ajout_seul" BEFORE UPDATE OR DELETE ON "liens_partage_acces"
  FOR EACH ROW EXECUTE FUNCTION "liens_partage_acces_garde"();

CREATE TRIGGER "liens_partage_acces_pas_de_truncate" BEFORE TRUNCATE ON "liens_partage_acces"
  FOR EACH STATEMENT EXECUTE FUNCTION "partages_refus_truncate"();
