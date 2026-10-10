-- ════════════════════════════════════════════════════════════════════════════
-- FORMATEURS FREELANCE — SCHÉMA N° 1 : SOCLE DU PARCOURS (2026-10-10)
--
-- ADR 0066 (parcours du formateur indépendant), ADR 0067 (une fiche par
-- relation). Quatre lots regroupés (M-G, M-A1, X2, M-A2), décision de Will : UNE
-- migration. M-CAL (`formateur` dans `type_rendez_vous`) est REPORTÉ : son
-- miroir TypeScript impose de toucher des fichiers de PR encore ouvertes.
--
-- 🔴 ADDITIVE SEULEMENT : aucun DROP, aucun RENAME, aucun changement de type.
-- Toute colonne ajoutée est nullable ou porte un défaut. L'ancien code (fenêtre
-- app/worker, cf. AGENTS.md) continue de fonctionner contre la base migrée : il
-- nomme ses colonnes, il ne voit pas les nouvelles. Livré ÉTEINT : aucun code de
-- ce lot ne lit ni n'écrit ces colonnes et tables.
--
-- ⚠️ SENS INVERSE, NON COUVERT PAR « ADDITIF » : un code NEUF contre une base
-- NON migrée. Le client Prisma régénéré sélectionne TOUTES les colonnes d'un
-- modèle quand une requête n'a pas de `select` : tant que cette migration n'est
-- pas passée (c'est l'entrypoint de l'APP qui migre), un worker déjà reconstruit
-- échouerait sur `trainers`, `job_offers`, `job_applications`,
-- `missions_formateur`, `session_formateurs`, `trainer_documents` et
-- `document_signature_tokens` (« column … does not exist »). Voir la PR.
--
-- Objets SQL bruts (CHECK, triggers, index partiels) : partie 4, chacun déclaré
-- dans `src/server/qualiopi/formateurs-independants/socle-objets-sql.ts` et
-- vérifié dans `pg_constraint` / `pg_trigger` / `pg_indexes`
-- (`tests/integration/formateurs-socle/`).
-- ════════════════════════════════════════════════════════════════════════════

-- ═══ 1. VALEURS AJOUTÉES À DES ÉNUMÉRATIONS EXISTANTES ══════════════════════
--
-- Une instruction par valeur. Ajout seul, admis dans une transaction depuis
-- PostgreSQL 12 — mais une valeur ajoutée n'est UTILISABLE qu'après le COMMIT :
-- aucune de ces valeurs n'est donc employée dans cette migration (vérifié par
-- le test de texte). `IF NOT EXISTS` rend le rejeu inoffensif.
ALTER TYPE "MissionFormateurStatut" ADD VALUE IF NOT EXISTS 'desistee';

ALTER TYPE "SessionFormateurRetraitMotif" ADD VALUE IF NOT EXISTS 'desistement_formateur';

ALTER TYPE "SessionFormateurRetraitMotif" ADD VALUE IF NOT EXISTS 'formateur_desactive';

ALTER TYPE "TrainerDocumentType" ADD VALUE IF NOT EXISTS 'recepisse_declaration_activite';

ALTER TYPE "TrainerDocumentType" ADD VALUE IF NOT EXISTS 'rib';

-- ═══ 2. TYPES, COLONNES ET TABLES (texte de `prisma migrate diff`) ═════════

-- CreateEnum
CREATE TYPE "nature_collaboration" AS ENUM ('salarie', 'freelance');

-- CreateEnum
CREATE TYPE "activation_validee_source" AS ENUM ('controle', 'anterieure_au_controle');

-- CreateEnum
CREATE TYPE "fin_collaboration_motif" AS ENUM ('changement_de_nature');

-- CreateEnum
CREATE TYPE "dossier_formateur_statut" AS ENUM ('en_cours', 'a_verifier', 'a_completer', 'verifie');

-- CreateEnum
CREATE TYPE "origine_candidature" AS ENUM ('formulaire', 'console');

-- CreateEnum
CREATE TYPE "issue_invitation_formateur" AS ENUM ('acceptee', 'declinee', 'sans_reponse');

-- CreateEnum
CREATE TYPE "verdict_registre" AS ENUM ('vert', 'orange', 'rouge');

-- CreateEnum
CREATE TYPE "resultat_preuve_vigilance" AS ENUM ('valide', 'invalide', 'a_controler');

-- AlterTable
ALTER TABLE "document_signature_tokens" ADD COLUMN     "code_envoye_at" TIMESTAMP(3),
ADD COLUMN     "code_essais" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "code_expire_at" TIMESTAMP(3),
ADD COLUMN     "code_sha256" CHAR(64),
ADD COLUMN     "code_valide_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN     "cloture_sans_suite_at" TIMESTAMP(3),
ADD COLUMN     "invitation_formateur_at" TIMESTAMP(3),
ADD COLUMN     "invitation_formateur_issue" "issue_invitation_formateur",
ADD COLUMN     "nature_collaboration" "nature_collaboration",
ADD COLUMN     "origine" "origine_candidature" NOT NULL DEFAULT 'formulaire',
ADD COLUMN     "rattrapage_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN     "nature_collaboration" "nature_collaboration" NOT NULL DEFAULT 'salarie';

-- AlterTable
ALTER TABLE "missions_formateur" ADD COLUMN     "desiste_at" TIMESTAMP(3),
ADD COLUMN     "desiste_motif" TEXT,
ADD COLUMN     "forfait_deplacement_par_jour_ht_cents" INTEGER,
ADD COLUMN     "lettre_alerte_j7_at" TIMESTAMP(3),
ADD COLUMN     "lettre_blocage_motif" TEXT,
ADD COLUMN     "lettre_blocage_notifie_at" TIMESTAMP(3),
ADD COLUMN     "lettre_mission_id" UUID,
ADD COLUMN     "lettre_relance_at" TIMESTAMP(3),
ADD COLUMN     "regime_tva_fige" "TvaRegimeHonoraires",
ADD COLUMN     "tarif_ht_cents" INTEGER;

-- AlterTable
ALTER TABLE "session_formateurs" ADD COLUMN     "intervenant_annonce_client_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "trainer_documents" ADD COLUMN     "archive_at" TIMESTAMP(3),
ADD COLUMN     "archive_motif" TEXT,
ADD COLUMN     "archive_par_id" UUID;

-- AlterTable
ALTER TABLE "trainers" ADD COLUMN     "acces_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "activation_validee_at" TIMESTAMP(3),
ADD COLUMN     "activation_validee_par_id" UUID,
ADD COLUMN     "activation_validee_source" "activation_validee_source",
ADD COLUMN     "candidature_id" UUID,
ADD COLUMN     "code_postal_pro" VARCHAR(5),
ADD COLUMN     "commune_insee" CHAR(5),
ADD COLUMN     "declarations" JSONB,
ADD COLUMN     "declarations_at" TIMESTAMP(3),
ADD COLUMN     "declarations_version" VARCHAR(20),
ADD COLUMN     "dossier_envoye_at" TIMESTAMP(3),
ADD COLUMN     "dossier_ouvert_at" TIMESTAMP(3),
ADD COLUMN     "dossier_statut" "dossier_formateur_statut",
ADD COLUMN     "dossier_verifie_at" TIMESTAMP(3),
ADD COLUMN     "email_hash" CHAR(64),
ADD COLUMN     "est_test_interne" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fin_collaboration_at" TIMESTAMP(3),
ADD COLUMN     "fin_collaboration_motif" "fin_collaboration_motif",
ADD COLUMN     "fin_collaboration_par_id" UUID,
ADD COLUMN     "geo_calcule_at" TIMESTAMP(3),
ADD COLUMN     "geo_lat" DECIMAL(9,6),
ADD COLUMN     "geo_lng" DECIMAL(9,6),
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "iban_empreinte" CHAR(64),
ADD COLUMN     "mise_a_niveau_listee_at" TIMESTAMP(3),
ADD COLUMN     "nda_verifie_liste_at" TIMESTAMP(3),
ADD COLUMN     "organisme_sous_traitant_id" UUID;

-- CreateTable
CREATE TABLE "verifications_registre_sous_traitance" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "verifie_at" TIMESTAMP(3) NOT NULL,
    "verdict" "verdict_registre" NOT NULL,
    "source" VARCHAR(120) NOT NULL,
    "siren" CHAR(9),
    "siret" CHAR(14),
    "numero_declaration_activite" VARCHAR(20),
    "reponse_source" JSONB,
    "reponse_sha256" CHAR(64),
    "motif" TEXT,
    "verifie_par_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_registre_sous_traitance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preuves_vigilance" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "trainer_document_id" UUID,
    "verifiee_at" TIMESTAMP(3) NOT NULL,
    "resultat" "resultat_preuve_vigilance" NOT NULL,
    "code_verification" VARCHAR(60),
    "date_attestation" TIMESTAMP(3),
    "date_fin_validite" TIMESTAMP(3),
    "fichier_sha256" CHAR(64),
    "verifiee_par_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preuves_vigilance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_document_contenus" (
    "trainer_document_id" UUID NOT NULL,
    "octets" BYTEA NOT NULL,
    "taille" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "mime" VARCHAR(100) NOT NULL,
    "nom_original" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainer_document_contenus_pkey" PRIMARY KEY ("trainer_document_id")
);

-- CreateTable
CREATE TABLE "choix_formateur_session" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "rang" INTEGER NOT NULL,
    "tarif_ht_cents" INTEGER,
    "forfait_deplacement_par_jour_ht_cents" INTEGER,
    "saute_at" TIMESTAMP(3),
    "saute_motif" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "choix_formateur_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verifications_registre_sous_traitance_trainer_id_verifie_at_idx" ON "verifications_registre_sous_traitance"("trainer_id", "verifie_at");

-- CreateIndex
CREATE INDEX "preuves_vigilance_trainer_id_verifiee_at_idx" ON "preuves_vigilance"("trainer_id", "verifiee_at");

-- CreateIndex
CREATE INDEX "preuves_vigilance_trainer_document_id_idx" ON "preuves_vigilance"("trainer_document_id");

-- CreateIndex
CREATE INDEX "choix_formateur_session_trainer_id_idx" ON "choix_formateur_session"("trainer_id");

-- CreateIndex
CREATE UNIQUE INDEX "choix_formateur_session_session_id_rang_key" ON "choix_formateur_session"("session_id", "rang");

-- CreateIndex
CREATE UNIQUE INDEX "choix_formateur_session_session_id_trainer_id_key" ON "choix_formateur_session"("session_id", "trainer_id");


-- AddForeignKey
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_organisme_sous_traitant_id_fkey" FOREIGN KEY ("organisme_sous_traitant_id") REFERENCES "sous_traitants_of"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_candidature_id_fkey" FOREIGN KEY ("candidature_id") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions_formateur" ADD CONSTRAINT "missions_formateur_lettre_mission_id_fkey" FOREIGN KEY ("lettre_mission_id") REFERENCES "documents_generes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications_registre_sous_traitance" ADD CONSTRAINT "verifications_registre_sous_traitance_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preuves_vigilance" ADD CONSTRAINT "preuves_vigilance_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preuves_vigilance" ADD CONSTRAINT "preuves_vigilance_trainer_document_id_fkey" FOREIGN KEY ("trainer_document_id") REFERENCES "trainer_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_document_contenus" ADD CONSTRAINT "trainer_document_contenus_trainer_document_id_fkey" FOREIGN KEY ("trainer_document_id") REFERENCES "trainer_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_formateur_session" ADD CONSTRAINT "choix_formateur_session_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_formateur_session" ADD CONSTRAINT "choix_formateur_session_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══ 3. REMPLISSAGE ═════════════════════════════════════════════════════════

-- M-G — nature de la collaboration des offres : traduction SQL EXACTE du prédicat
-- `estCandidatureFormateurFreelance` (texte de `src/lib/careers/nature-collaboration-sql.ts`,
-- comparé au prédicat TypeScript par le test d'intégration). Les autres offres
-- gardent le défaut `salarie`.
UPDATE "job_offers" AS o
SET "nature_collaboration" = 'freelance'
FROM (
  SELECT j."id", j."slug", j."employment_type", j."secondary_employment_type",
         ARRAY[lower(regexp_replace(normalize(coalesce(j."title_fr", ''), NFD), '[\u0300-\u036f]', '', 'g')), lower(regexp_replace(normalize(coalesce(replace(j."slug", '-', ' '), ''), NFD), '[\u0300-\u036f]', '', 'g'))] AS "textes"
  FROM "job_offers" AS j
) AS p
WHERE p."id" = o."id" AND (
  coalesce(p."slug", '') = 'formateur-ia-freelance'
  OR (
    EXISTS (SELECT 1 FROM unnest(p."textes") AS t(v) WHERE t.v ~ '(formateur|formatrice)')
    AND (
      EXISTS (SELECT 1 FROM unnest(p."textes") AS t(v)
              WHERE t.v ~ '(formateur|formatrice)' AND t.v ~ '(freelance|independant)')
      OR coalesce(p."employment_type", '') = 'CONTRACTOR'
      OR coalesce(p."secondary_employment_type", '') = 'CONTRACTOR'
    )
  )
);

-- M-G — candidatures à une offre : copie de la nature de l'offre (remplie ci-dessus).
UPDATE "job_applications" AS a
SET "nature_collaboration" = o."nature_collaboration"
FROM "job_offers" AS o
WHERE o."id" = a."offer_id";

-- M-G — candidatures sans offre (spontanée, offre supprimée) : prédicat d'intitulé
-- sur le titre figé ; sinon NULL (inconnu), jamais `salarie` par défaut.
UPDATE "job_applications" AS a
SET "nature_collaboration" = 'freelance'
FROM (
  SELECT x."id", NULL::text AS "slug", NULL::text AS "employment_type",
         NULL::text AS "secondary_employment_type",
         ARRAY[lower(regexp_replace(normalize(coalesce(x."offer_title_snap", ''), NFD), '[\u0300-\u036f]', '', 'g'))] AS "textes"
  FROM "job_applications" AS x
  WHERE x."offer_id" IS NULL
) AS p
WHERE p."id" = a."id" AND (
  coalesce(p."slug", '') = 'formateur-ia-freelance'
  OR (
    EXISTS (SELECT 1 FROM unnest(p."textes") AS t(v) WHERE t.v ~ '(formateur|formatrice)')
    AND (
      EXISTS (SELECT 1 FROM unnest(p."textes") AS t(v)
              WHERE t.v ~ '(formateur|formatrice)' AND t.v ~ '(freelance|independant)')
      OR coalesce(p."employment_type", '') = 'CONTRACTOR'
      OR coalesce(p."secondary_employment_type", '') = 'CONTRACTOR'
    )
  )
);

-- M-A1 — le stock ACTIF est marqué « activé avant le contrôle » : un constat daté de
-- la migration, SANS auteur (ce n'est pas une validation). AVANT le CHECK de cohérence.
UPDATE "trainers" SET "activation_validee_source" = 'anterieure_au_controle', "activation_validee_at" = now() WHERE "actif" = true;

-- ═══ 4. SQL BRUT — CHECK, TRIGGERS, INDEX PARTIELS ═════════════════════════
--
-- Chacun est déclaré dans `socle-objets-sql.ts` (registre unique) : le test de
-- texte refuse un objet créé ici et non déclaré, et la garde de dérive le
-- cherche dans le catalogue de la base migrée.

-- ── trainers ────────────────────────────────────────────────────────────────
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_activation_coherente" CHECK (
  ("activation_validee_source" IS NULL
     AND "activation_validee_at" IS NULL AND "activation_validee_par_id" IS NULL)
  OR ("activation_validee_source" = 'controle'
     AND "activation_validee_at" IS NOT NULL AND "activation_validee_par_id" IS NOT NULL)
  OR ("activation_validee_source" = 'anterieure_au_controle'
     AND "activation_validee_at" IS NOT NULL AND "activation_validee_par_id" IS NULL)
);

-- IBAN : jamais en clair, jamais en v1 (sans AAD) — seulement `enc:v2:`.
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_iban_chiffre_v2" CHECK (
  "iban" IS NULL OR "iban" LIKE 'enc:v2:%'
);

ALTER TABLE "trainers" ADD CONSTRAINT "trainers_iban_empreinte_coherente" CHECK (
  ("iban" IS NULL) = ("iban_empreinte" IS NULL)
  AND ("iban_empreinte" IS NULL OR "iban_empreinte" ~ '^[0-9a-f]{64}$')
);

ALTER TABLE "trainers" ADD CONSTRAINT "trainers_acces_version_positive" CHECK (
  "acces_version" >= 0
);

ALTER TABLE "trainers" ADD CONSTRAINT "trainers_fin_collaboration_coherente" CHECK (
  ("fin_collaboration_at" IS NULL) = ("fin_collaboration_motif" IS NULL)
  AND ("fin_collaboration_par_id" IS NULL OR "fin_collaboration_at" IS NOT NULL)
);

ALTER TABLE "trainers" ADD CONSTRAINT "trainers_geo_coherente" CHECK (
  ("geo_lat" IS NULL) = ("geo_lng" IS NULL)
  AND ("geo_lat" IS NULL OR ("geo_lat" BETWEEN -90 AND 90 AND "geo_lng" BETWEEN -180 AND 180))
);

ALTER TABLE "trainers" ADD CONSTRAINT "trainers_email_hash_hex" CHECK (
  "email_hash" IS NULL OR "email_hash" ~ '^[0-9a-f]{64}$'
);

-- ADR 0067, étape « expand » : une seule fiche OUVERTE par adresse (comparaison
-- `citext`). L'unique GLOBAL `trainers_email_key` reste en place, plus strict :
-- il ne sera retiré qu'après la bascule du code (étape « contract »).
CREATE UNIQUE INDEX "trainers_email_ouverte_unique" ON "trainers"("email") WHERE "fin_collaboration_at" IS NULL;

-- Une candidature n'ouvre qu'une fiche.
CREATE UNIQUE INDEX "trainers_candidature_unique" ON "trainers"("candidature_id") WHERE "candidature_id" IS NOT NULL;

-- ── missions_formateur ──────────────────────────────────────────────────────
ALTER TABLE "missions_formateur" ADD CONSTRAINT "missions_formateur_montants_positifs" CHECK (
  ("tarif_ht_cents" IS NULL OR "tarif_ht_cents" >= 0)
  AND ("forfait_deplacement_par_jour_ht_cents" IS NULL OR "forfait_deplacement_par_jour_ht_cents" >= 0)
);

ALTER TABLE "missions_formateur" ADD CONSTRAINT "missions_formateur_desistement_coherent" CHECK (
  "desiste_motif" IS NULL OR "desiste_at" IS NOT NULL
);

ALTER TABLE "missions_formateur" ADD CONSTRAINT "missions_formateur_blocage_coherent" CHECK (
  "lettre_blocage_notifie_at" IS NULL OR "lettre_blocage_motif" IS NOT NULL
);

-- ── trainer_documents ───────────────────────────────────────────────────────
ALTER TABLE "trainer_documents" ADD CONSTRAINT "trainer_documents_archive_coherent" CHECK (
  ("archive_par_id" IS NULL AND "archive_motif" IS NULL) OR "archive_at" IS NOT NULL
);

-- ── document_signature_tokens ───────────────────────────────────────────────
ALTER TABLE "document_signature_tokens" ADD CONSTRAINT "document_signature_tokens_code_coherent" CHECK (
  "code_essais" >= 0
  AND ("code_sha256" IS NULL OR "code_sha256" ~ '^[0-9a-f]{64}$')
  AND ("code_sha256" IS NOT NULL
       OR ("code_envoye_at" IS NULL AND "code_expire_at" IS NULL AND "code_valide_at" IS NULL))
);

-- ── trainer_document_contenus ───────────────────────────────────────────────
ALTER TABLE "trainer_document_contenus" ADD CONSTRAINT "trainer_document_contenus_taille" CHECK (
  "taille" = octet_length("octets") AND "taille" BETWEEN 1 AND 20971520
);

ALTER TABLE "trainer_document_contenus" ADD CONSTRAINT "trainer_document_contenus_sha256_hex" CHECK (
  "sha256" ~ '^[0-9a-f]{64}$'
);

-- ── choix_formateur_session ─────────────────────────────────────────────────
ALTER TABLE "choix_formateur_session" ADD CONSTRAINT "choix_formateur_session_rang_positif" CHECK (
  "rang" >= 1
);

ALTER TABLE "choix_formateur_session" ADD CONSTRAINT "choix_formateur_session_montants_positifs" CHECK (
  ("tarif_ht_cents" IS NULL OR "tarif_ht_cents" >= 0)
  AND ("forfait_deplacement_par_jour_ht_cents" IS NULL OR "forfait_deplacement_par_jour_ht_cents" >= 0)
);

ALTER TABLE "choix_formateur_session" ADD CONSTRAINT "choix_formateur_session_saut_coherent" CHECK (
  "saute_motif" IS NULL OR "saute_at" IS NOT NULL
);

-- ── Preuves en AJOUT SEUL ───────────────────────────────────────────────────
--
-- Une preuve horodatée (contrôle registre, vigilance URSSAF) ne se corrige pas :
-- on en inscrit une nouvelle. Ni UPDATE, ni DELETE, ni TRUNCATE — même par la
-- suppression d'un formateur (clé étrangère RESTRICT).
ALTER TABLE "verifications_registre_sous_traitance" ADD CONSTRAINT "verifications_registre_sous_traitance_sha256_hex" CHECK (
  "reponse_sha256" IS NULL OR "reponse_sha256" ~ '^[0-9a-f]{64}$'
);

ALTER TABLE "preuves_vigilance" ADD CONSTRAINT "preuves_vigilance_sha256_hex" CHECK (
  "fichier_sha256" IS NULL OR "fichier_sha256" ~ '^[0-9a-f]{64}$'
);

CREATE OR REPLACE FUNCTION "formateurs_preuve_ajout_seul"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'table % en ajout seul : % refusé', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "verifications_registre_sous_traitance_ajout_seul"
  BEFORE UPDATE OR DELETE ON "verifications_registre_sous_traitance"
  FOR EACH ROW EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();

CREATE TRIGGER "verifications_registre_sous_traitance_pas_de_truncate"
  BEFORE TRUNCATE ON "verifications_registre_sous_traitance"
  FOR EACH STATEMENT EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();

CREATE TRIGGER "preuves_vigilance_ajout_seul"
  BEFORE UPDATE OR DELETE ON "preuves_vigilance"
  FOR EACH ROW EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();

CREATE TRIGGER "preuves_vigilance_pas_de_truncate"
  BEFORE TRUNCATE ON "preuves_vigilance"
  FOR EACH STATEMENT EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();
