-- ════════════════════════════════════════════════════════════════════════════
-- FORMATEURS FREELANCE — SCHÉMA N° 2 : PAIEMENT PAR MISSION (2026-10-11)
--
-- ADR 0066 v2 (e). Trois lots regroupés en UNE migration (10-PLAN §16) :
--   · M-C « expand » — paiement par mission SANS DOUBLE : origine, session et
--     organisme sur les relevés ; objet, origine et motif d'annulation sur les
--     lignes ; table de revendication en ajout seul ; index uniques PARTIELS ;
--   · M-E — demandes de changement de coordonnées (IBAN chiffré `enc:v2:`) ;
--   · M-F — pièces des organismes sous-traitants (octets chiffrés à part).
-- Plus la trace du motif d'une commission d'apporteur mise à 0 (L12j), dans
-- une table À PART : `commissions_apporteur` n'est pas modifiée.
--
-- 🔴 ADDITIVE SEULEMENT : aucun DROP, aucun RENAME, aucun changement de type,
-- rien de rendu obligatoire sur des données existantes. Les deux colonnes
-- NOT NULL ajoutées (`origine`) portent un défaut constant : PostgreSQL ne
-- réécrit pas la table.
--
-- 🔴 M-D (« contract » : retrait de l'unique `statement_unique_trainer_periode`)
-- N'EST PAS DANS CETTE MIGRATION. C'est un DROP : il viendra plus tard, après une
-- mise en ligne de celle-ci. Tant qu'il n'est pas fait, un relevé de mission ne
-- peut pas coexister avec le relevé mensuel du même mois : le paiement par
-- mission reste COUPÉ (`formateurs.passage_paiement` sans date).
--
-- Livré ÉTEINT : aucun chemin en ligne n'écrit ces tables ni ces colonnes. Le run
-- mensuel ne les nomme pas (`origine` prend son défaut, `objet` reste NULL).
--
-- ⚠️ SENS INVERSE, NON COUVERT PAR « ADDITIF » (même réserve que le schéma n° 1) :
-- un code NEUF contre une base NON migrée. Le client régénéré sélectionne toutes
-- les colonnes d'un modèle quand une requête n'a pas de `select` : tant que cette
-- migration n'est pas passée (c'est l'entrypoint de l'APP qui migre), un worker
-- déjà reconstruit échouerait sur `trainer_statements` et `trainer_fee_lines`.
--
-- Objets SQL bruts (partie 3) : chacun déclaré dans
-- `src/server/qualiopi/formateurs-independants/paiement-objets-sql.ts` et vérifié
-- dans `pg_constraint` / `pg_trigger` / `pg_indexes`
-- (`tests/integration/formateurs-paiement/`).
-- ════════════════════════════════════════════════════════════════════════════

-- ═══ 1. TYPES, COLONNES ET TABLES (texte de `prisma migrate diff`) ═════════

-- CreateEnum
CREATE TYPE "origine_honoraire" AS ENUM ('releve_mensuel', 'passage_mission');

-- CreateEnum
CREATE TYPE "objet_ligne_honoraire" AS ENUM ('animation', 'deplacement', 'indemnite_annulation', 'presentation_methode', 'ajustement', 'penalites_retard', 'indemnite_recouvrement');

-- CreateEnum
CREATE TYPE "annule_motif_ligne" AS ENUM ('recalcul', 'session_annulee', 'ajustement_remplace', 'autre');

-- CreateEnum
CREATE TYPE "regime_paiement" AS ENUM ('releve_mensuel', 'par_mission');

-- CreateEnum
CREATE TYPE "source_revendication" AS ENUM ('stock_migration', 'run_mensuel', 'passage_mission', 'rattrapage_console');

-- CreateEnum
CREATE TYPE "nature_changement_formateur" AS ENUM ('adresse', 'regime_tva', 'iban', 'email');

-- CreateEnum
CREATE TYPE "statut_demande_changement" AS ENUM ('en_attente', 'acceptee', 'refusee');

-- CreateEnum
CREATE TYPE "type_piece_organisme" AS ENUM ('attestation_vigilance_urssaf', 'kbis', 'liste_salaries_etrangers', 'nda', 'rc_pro', 'autre');

-- CreateEnum
CREATE TYPE "motif_commission_nulle" AS ENUM ('animee_par_l_apporteur');

-- AlterTable
ALTER TABLE "trainer_fee_lines" ADD COLUMN     "annule_motif" "annule_motif_ligne",
ADD COLUMN     "demi_journees" INTEGER,
ADD COLUMN     "impute_de_statement_id" UUID,
ADD COLUMN     "journees_deplacement" INTEGER,
ADD COLUMN     "objet" "objet_ligne_honoraire",
ADD COLUMN     "origine" "origine_honoraire" NOT NULL DEFAULT 'releve_mensuel';

-- AlterTable
ALTER TABLE "trainer_statements" ADD COLUMN     "avoir_de_id" UUID,
ADD COLUMN     "iban_empreinte" CHAR(64),
ADD COLUMN     "iban_fin4" VARCHAR(4),
ADD COLUMN     "organisme_sous_traitant_id" UUID,
ADD COLUMN     "origine" "origine_honoraire" NOT NULL DEFAULT 'releve_mensuel',
ADD COLUMN     "remboursement_demande_at" TIMESTAMP(3),
ADD COLUMN     "remplace_id" UUID,
ADD COLUMN     "session_id" UUID,
ADD COLUMN     "sur_constat_at" TIMESTAMP(3),
ADD COLUMN     "sur_constat_motif" TEXT,
ADD COLUMN     "sur_constat_par_id" UUID;

-- CreateTable
CREATE TABLE "revendications_paiement" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "regime" "regime_paiement" NOT NULL,
    "source" "source_revendication" NOT NULL,
    "revendique_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revendications_paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes_changement_formateur" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "nature" "nature_changement_formateur" NOT NULL,
    "valeur" TEXT NOT NULL,
    "valeur_empreinte" CHAR(64),
    "effet_at" TIMESTAMP(3),
    "statut" "statut_demande_changement" NOT NULL DEFAULT 'en_attente',
    "ancienne_adresse_avisee_at" TIMESTAMP(3),
    "traite_par_id" UUID,
    "traite_at" TIMESTAMP(3),
    "motif_refus" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demandes_changement_formateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_organismes" (
    "id" UUID NOT NULL,
    "sous_traitant_id" UUID NOT NULL,
    "type" "type_piece_organisme" NOT NULL,
    "numero_piece" VARCHAR(60),
    "date_emission" TIMESTAMP(3),
    "date_expiration" TIMESTAMP(3),
    "statut_validation" "DocumentValidationStatut" NOT NULL DEFAULT 'en_attente',
    "valide_par_id" UUID,
    "valide_at" TIMESTAMP(3),
    "rejet_motif" TEXT,
    "remplacee_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_organismes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_organismes_contenus" (
    "piece_organisme_id" UUID NOT NULL,
    "octets" BYTEA NOT NULL,
    "taille" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "mime" VARCHAR(100) NOT NULL,
    "nom_original" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_organismes_contenus_pkey" PRIMARY KEY ("piece_organisme_id")
);

-- CreateTable
CREATE TABLE "commissions_motif_nul" (
    "commission_id" UUID NOT NULL,
    "motif" "motif_commission_nulle" NOT NULL,
    "siren" CHAR(9) NOT NULL,
    "cree_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commissions_motif_nul_pkey" PRIMARY KEY ("commission_id")
);

-- CreateIndex
CREATE INDEX "revendications_paiement_session_id_idx" ON "revendications_paiement"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "revendications_paiement_trainer_id_session_id_key" ON "revendications_paiement"("trainer_id", "session_id");

-- CreateIndex
CREATE INDEX "demandes_changement_formateur_trainer_id_created_at_idx" ON "demandes_changement_formateur"("trainer_id", "created_at");

-- CreateIndex
CREATE INDEX "demandes_changement_formateur_statut_idx" ON "demandes_changement_formateur"("statut");

-- CreateIndex
CREATE INDEX "pieces_organismes_sous_traitant_id_type_idx" ON "pieces_organismes"("sous_traitant_id", "type");

-- CreateIndex
CREATE INDEX "pieces_organismes_date_expiration_idx" ON "pieces_organismes"("date_expiration");

-- CreateIndex
CREATE INDEX "trainer_fee_lines_impute_de_statement_id_idx" ON "trainer_fee_lines"("impute_de_statement_id");

-- CreateIndex
CREATE INDEX "trainer_statements_session_id_idx" ON "trainer_statements"("session_id");

-- CreateIndex
CREATE INDEX "trainer_statements_organisme_sous_traitant_id_idx" ON "trainer_statements"("organisme_sous_traitant_id");

-- CreateIndex
CREATE INDEX "trainer_statements_avoir_de_id_idx" ON "trainer_statements"("avoir_de_id");

-- CreateIndex
CREATE INDEX "trainer_statements_remplace_id_idx" ON "trainer_statements"("remplace_id");

-- AddForeignKey
ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "trainer_fee_lines_impute_de_statement_id_fkey" FOREIGN KEY ("impute_de_statement_id") REFERENCES "trainer_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_statements" ADD CONSTRAINT "trainer_statements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_statements" ADD CONSTRAINT "trainer_statements_organisme_sous_traitant_id_fkey" FOREIGN KEY ("organisme_sous_traitant_id") REFERENCES "sous_traitants_of"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_statements" ADD CONSTRAINT "trainer_statements_avoir_de_id_fkey" FOREIGN KEY ("avoir_de_id") REFERENCES "trainer_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_statements" ADD CONSTRAINT "trainer_statements_remplace_id_fkey" FOREIGN KEY ("remplace_id") REFERENCES "trainer_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revendications_paiement" ADD CONSTRAINT "revendications_paiement_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_changement_formateur" ADD CONSTRAINT "demandes_changement_formateur_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_organismes" ADD CONSTRAINT "pieces_organismes_sous_traitant_id_fkey" FOREIGN KEY ("sous_traitant_id") REFERENCES "sous_traitants_of"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_organismes_contenus" ADD CONSTRAINT "pieces_organismes_contenus_piece_organisme_id_fkey" FOREIGN KEY ("piece_organisme_id") REFERENCES "pieces_organismes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions_motif_nul" ADD CONSTRAINT "commissions_motif_nul_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions_apporteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══ 2. REMPLISSAGE — LE STOCK APPARTIENT AU RELEVÉ MENSUEL ═════════════════
--
-- 09-RELECTURE-ARGENT, point 1 (scénario S19) : toute (formateur indépendant,
-- session) portée par une ligne mensuelle NON ANNULÉE, QUEL QUE SOIT LE STATUT
-- DU RELEVÉ (brouillon compris), est revendiquée par le relevé mensuel. Le
-- paiement par mission la lira et s'abstiendra : jamais 1 400 € pour 1 050 € dus.
-- Insertion seule ; AVANT les triggers d'ajout seul (aucun conflit possible : la
-- table vient d'être créée). Texte exact : `SQL_REVENDIQUER_STOCK_MENSUEL`.
INSERT INTO "revendications_paiement" ("id", "trainer_id", "session_id", "regime", "source") SELECT gen_random_uuid(), l."trainer_id", l."session_id", 'releve_mensuel', 'stock_migration' FROM (SELECT DISTINCT fl."trainer_id", fl."session_id" FROM "trainer_fee_lines" fl JOIN "trainers" t ON t."id" = fl."trainer_id" WHERE t."statut" = 'sous_traitant' AND fl."session_id" IS NOT NULL AND fl."statut" <> 'annule' AND fl."origine" = 'releve_mensuel') l ON CONFLICT ("trainer_id", "session_id") DO NOTHING;

-- ═══ 3. SQL BRUT — CHECK, TRIGGERS, INDEX PARTIELS ═════════════════════════
--
-- Chacun est déclaré dans `paiement-objets-sql.ts` (registre unique) : le test
-- de texte refuse un objet créé ici et non déclaré, et la garde de dérive le
-- cherche dans le catalogue de la base migrée. Les index partiels sont recopiés
-- MOT POUR MOT de `SQL_INDEX_PAIEMENT` (clause d'occupation dérivée de
-- `STATUT_RELEVE_LIBERE`).

-- ── trainer_statements ──────────────────────────────────────────────────────
-- Un relevé mensuel ne porte ni session ni organisme.
ALTER TABLE "trainer_statements" ADD CONSTRAINT "trainer_statements_origine_coherente" CHECK (
  "origine" <> 'releve_mensuel'
  OR ("session_id" IS NULL AND "organisme_sous_traitant_id" IS NULL)
);

-- Preuve du compte payé (lue au clic « Virement fait ») : les deux ou aucune.
ALTER TABLE "trainer_statements" ADD CONSTRAINT "trainer_statements_iban_preuve_coherente" CHECK (
  ("iban_fin4" IS NULL) = ("iban_empreinte" IS NULL)
  AND ("iban_empreinte" IS NULL OR "iban_empreinte" ~ '^[0-9a-f]{64}$')
  AND ("iban_fin4" IS NULL OR "iban_fin4" ~ '^[0-9A-Z]{4}$')
);

ALTER TABLE "trainer_statements" ADD CONSTRAINT "trainer_statements_pas_soi_meme" CHECK (
  ("avoir_de_id" IS NULL OR "avoir_de_id" <> "id")
  AND ("remplace_id" IS NULL OR "remplace_id" <> "id")
);

ALTER TABLE "trainer_statements" ADD CONSTRAINT "trainer_statements_sur_constat_coherent" CHECK (
  ("sur_constat_at" IS NULL) = ("sur_constat_par_id" IS NULL)
  AND ("sur_constat_at" IS NULL) = ("sur_constat_motif" IS NULL)
  AND ("sur_constat_motif" IS NULL OR length(btrim("sur_constat_motif")) > 0)
);

CREATE UNIQUE INDEX "trainer_statements_mission_unique" ON "trainer_statements" ("trainer_id", "session_id", "periode_year", "periode_month") WHERE "origine" = 'passage_mission' AND "session_id" IS NOT NULL AND "organisme_sous_traitant_id" IS NULL AND "avoir_de_id" IS NULL AND "statut" <> 'annule';

CREATE UNIQUE INDEX "trainer_statements_mission_organisme_unique" ON "trainer_statements" ("organisme_sous_traitant_id", "session_id", "periode_year", "periode_month") WHERE "origine" = 'passage_mission' AND "session_id" IS NOT NULL AND "organisme_sous_traitant_id" IS NOT NULL AND "avoir_de_id" IS NULL AND "statut" <> 'annule';

CREATE UNIQUE INDEX "trainer_statements_mensuel_unique" ON "trainer_statements" ("trainer_id", "periode_year", "periode_month") WHERE "origine" = 'releve_mensuel' AND "statut" <> 'annule';

CREATE UNIQUE INDEX "trainer_statements_hors_mission_unique" ON "trainer_statements" ("trainer_id", "periode_year", "periode_month") WHERE "origine" = 'passage_mission' AND "session_id" IS NULL AND "avoir_de_id" IS NULL AND "statut" <> 'annule';

CREATE UNIQUE INDEX "trainer_statements_avoir_unique" ON "trainer_statements" ("avoir_de_id") WHERE "avoir_de_id" IS NOT NULL;

CREATE UNIQUE INDEX "trainer_statements_facture_emetteur_unique" ON "trainer_statements" (COALESCE("organisme_sous_traitant_id", "trainer_id"), "numero_facture") WHERE "origine" = 'passage_mission' AND "autofacture_at" IS NULL AND "numero_facture" IS NOT NULL AND "statut" <> 'annule';

-- ── trainer_fee_lines ───────────────────────────────────────────────────────
ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "trainer_fee_lines_objet_mission" CHECK (
  "origine" <> 'passage_mission' OR "objet" IS NOT NULL
);

-- Seule une ligne ANNULÉE porte un motif d'annulation (les lignes annulées
-- existantes n'en ont pas : permis).
ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "trainer_fee_lines_annule_motif_coherent" CHECK (
  "annule_motif" IS NULL OR "statut" = 'annule'
);

ALTER TABLE "trainer_fee_lines" ADD CONSTRAINT "trainer_fee_lines_quantites_positives" CHECK (
  ("demi_journees" IS NULL OR "demi_journees" >= 0)
  AND ("journees_deplacement" IS NULL OR "journees_deplacement" >= 0)
);

CREATE UNIQUE INDEX "trainer_fee_lines_mission_unique" ON "trainer_fee_lines" ("trainer_id", "session_id", "objet", "periode_year", "periode_month") WHERE "origine" = 'passage_mission' AND "session_id" IS NOT NULL AND "objet" IN ('animation', 'deplacement') AND "statut" <> 'annule';

CREATE UNIQUE INDEX "trainer_fee_lines_indemnite_annulation_unique" ON "trainer_fee_lines" ("trainer_id", "session_id") WHERE "origine" = 'passage_mission' AND "objet" = 'indemnite_annulation' AND "statut" <> 'annule';

CREATE UNIQUE INDEX "trainer_fee_lines_presentation_methode_unique" ON "trainer_fee_lines" ("trainer_id") WHERE "objet" = 'presentation_methode' AND "statut" <> 'annule';

CREATE UNIQUE INDEX "trainer_fee_lines_retard_unique" ON "trainer_fee_lines" ("statement_id", "objet") WHERE "objet" IN ('penalites_retard', 'indemnite_recouvrement') AND "statut" <> 'annule';

CREATE UNIQUE INDEX "trainer_fee_lines_imputation_unique" ON "trainer_fee_lines" ("impute_de_statement_id", "statement_id") WHERE "impute_de_statement_id" IS NOT NULL AND "statut" <> 'annule';

-- ── revendications_paiement : AJOUT SEUL ────────────────────────────────────
-- Le premier propriétaire inscrit est le seul (ADR 0066 v2 (e)). Fonction du
-- schéma n° 1, réutilisée telle quelle.
CREATE TRIGGER "revendications_paiement_ajout_seul"
  BEFORE UPDATE OR DELETE ON "revendications_paiement"
  FOR EACH ROW EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();

CREATE TRIGGER "revendications_paiement_pas_de_truncate"
  BEFORE TRUNCATE ON "revendications_paiement"
  FOR EACH STATEMENT EXECUTE FUNCTION "formateurs_preuve_ajout_seul"();

-- ── demandes_changement_formateur ───────────────────────────────────────────
-- IBAN demandé : jamais en clair, jamais en v1 (sans AAD) ; avec son empreinte.
ALTER TABLE "demandes_changement_formateur" ADD CONSTRAINT "demandes_changement_formateur_iban_chiffre" CHECK (
  "nature" <> 'iban' OR ("valeur" LIKE 'enc:v2:%' AND "valeur_empreinte" IS NOT NULL)
);

ALTER TABLE "demandes_changement_formateur" ADD CONSTRAINT "demandes_changement_formateur_empreinte_hex" CHECK (
  "valeur_empreinte" IS NULL OR "valeur_empreinte" ~ '^[0-9a-f]{64}$'
);

ALTER TABLE "demandes_changement_formateur" ADD CONSTRAINT "demandes_changement_formateur_traitement_coherent" CHECK (
  ("statut" = 'en_attente') = ("traite_at" IS NULL)
  AND ("statut" = 'en_attente' OR "traite_par_id" IS NOT NULL)
  AND ("statut" <> 'refusee' OR length(btrim(coalesce("motif_refus", ''))) > 0)
);

CREATE UNIQUE INDEX "demandes_changement_formateur_une_en_attente" ON "demandes_changement_formateur" ("trainer_id", "nature") WHERE "statut" = 'en_attente';

-- ── pieces_organismes ───────────────────────────────────────────────────────
ALTER TABLE "pieces_organismes" ADD CONSTRAINT "pieces_organismes_validation_coherente" CHECK (
  "statut_validation" <> 'rejete' OR length(btrim(coalesce("rejet_motif", ''))) > 0
);

-- ── pieces_organismes_contenus ──────────────────────────────────────────────
ALTER TABLE "pieces_organismes_contenus" ADD CONSTRAINT "pieces_organismes_contenus_taille" CHECK (
  "taille" = octet_length("octets") AND "taille" BETWEEN 1 AND 20971520
);

ALTER TABLE "pieces_organismes_contenus" ADD CONSTRAINT "pieces_organismes_contenus_sha256_hex" CHECK (
  "sha256" ~ '^[0-9a-f]{64}$'
);

-- ── commissions_motif_nul ───────────────────────────────────────────────────
ALTER TABLE "commissions_motif_nul" ADD CONSTRAINT "commissions_motif_nul_siren" CHECK (
  "siren" ~ '^[0-9]{9}$'
);
