-- Qualiopi ind. 27 (non-conformité majeure, audit du 16/10) — le registre des
-- sous-traitants tenu par l'outil pour les formateurs INDÉPENDANTS, et la trace de
-- chaque contrôle fait. Livré ÉTEINT : rien n'écrit dans ces tables tant que
-- l'interrupteur `formateurs.registre_sous_traitants` est coupé.
--
-- ADDITIVE seulement : trois types et quatre tables neuves, vides. Aucun DROP, aucune
-- ligne existante touchée. Rien n'est supprimé : les clés étrangères vers les fiches,
-- le registre et les contrôles sont en RESTRICT (une sortie est un statut daté, jamais
-- une suppression) ; seule la mission contrôlée est en SET NULL (la trace survit à la
-- session). Les écarts d'un contrôle à preuves (plan de correction à échéance, ou
-- suspension levée par décision motivée) ont leurs deux tables.

-- CreateEnum
CREATE TYPE "statut_registre_sous_traitant" AS ENUM ('actif', 'suspendu', 'sorti');

-- CreateEnum
CREATE TYPE "resultat_controle_sous_traitant" AS ENUM ('conforme', 'non_conforme', 'a_revoir');

-- CreateEnum
CREATE TYPE "gravite_ecart_sous_traitant" AS ENUM ('majeur', 'mineur');

-- CreateTable
CREATE TABLE IF NOT EXISTS "registre_sous_traitants_independants" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "sous_traitant_id" UUID NOT NULL,
    "date_entree" TIMESTAMP(3) NOT NULL,
    "statut" "statut_registre_sous_traitant" NOT NULL DEFAULT 'actif',
    "statut_depuis" TIMESTAMP(3) NOT NULL,
    "date_sortie" TIMESTAMP(3),
    "motif_sortie" TEXT,
    "synchronise_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registre_sous_traitants_independants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "controles_sous_traitants" (
    "id" UUID NOT NULL,
    "registre_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "fait_at" TIMESTAMP(3) NOT NULL,
    "auteur_id" UUID,
    "resultat" "resultat_controle_sous_traitant" NOT NULL,
    "motif" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mission_id" UUID,
    "preuves" JSONB,

    CONSTRAINT "controles_sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ecarts_sous_traitants" (
    "id" UUID NOT NULL,
    "registre_id" UUID NOT NULL,
    "controle_id" UUID NOT NULL,
    "preuve_code" VARCHAR(60) NOT NULL,
    "gravite" "gravite_ecart_sous_traitant" NOT NULL,
    "constate_at" TIMESTAMP(3) NOT NULL,
    "echeance_correction_at" TIMESTAMP(3),
    "corrige_at" TIMESTAMP(3),
    "corrige_par_id" UUID,
    "motif_correction" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ecarts_sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "suspensions_sous_traitants" (
    "id" UUID NOT NULL,
    "registre_id" UUID NOT NULL,
    "controle_id" UUID,
    "suspendu_at" TIMESTAMP(3) NOT NULL,
    "suspendu_par_id" UUID,
    "motif" TEXT NOT NULL,
    "levee_at" TIMESTAMP(3),
    "levee_par_id" UUID,
    "motif_levee" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suspensions_sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "registre_sous_traitants_independants_trainer_id_key" ON "registre_sous_traitants_independants"("trainer_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "registre_sous_traitants_independants_sous_traitant_id_key" ON "registre_sous_traitants_independants"("sous_traitant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "registre_sous_traitants_independants_statut_idx" ON "registre_sous_traitants_independants"("statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "controles_sous_traitants_registre_id_code_fait_at_idx" ON "controles_sous_traitants"("registre_id", "code", "fait_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "controles_sous_traitants_mission_id_idx" ON "controles_sous_traitants"("mission_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ecarts_sous_traitants_registre_id_corrige_at_idx" ON "ecarts_sous_traitants"("registre_id", "corrige_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ecarts_sous_traitants_controle_id_idx" ON "ecarts_sous_traitants"("controle_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "suspensions_sous_traitants_registre_id_levee_at_idx" ON "suspensions_sous_traitants"("registre_id", "levee_at");

-- AddForeignKey
ALTER TABLE "registre_sous_traitants_independants" ADD CONSTRAINT "registre_sous_traitants_independants_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registre_sous_traitants_independants" ADD CONSTRAINT "registre_sous_traitants_independants_sous_traitant_id_fkey" FOREIGN KEY ("sous_traitant_id") REFERENCES "sous_traitants_of"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controles_sous_traitants" ADD CONSTRAINT "controles_sous_traitants_registre_id_fkey" FOREIGN KEY ("registre_id") REFERENCES "registre_sous_traitants_independants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controles_sous_traitants" ADD CONSTRAINT "controles_sous_traitants_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions_formateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecarts_sous_traitants" ADD CONSTRAINT "ecarts_sous_traitants_registre_id_fkey" FOREIGN KEY ("registre_id") REFERENCES "registre_sous_traitants_independants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecarts_sous_traitants" ADD CONSTRAINT "ecarts_sous_traitants_controle_id_fkey" FOREIGN KEY ("controle_id") REFERENCES "controles_sous_traitants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspensions_sous_traitants" ADD CONSTRAINT "suspensions_sous_traitants_registre_id_fkey" FOREIGN KEY ("registre_id") REFERENCES "registre_sous_traitants_independants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspensions_sous_traitants" ADD CONSTRAINT "suspensions_sous_traitants_controle_id_fkey" FOREIGN KEY ("controle_id") REFERENCES "controles_sous_traitants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

