-- Qualiopi ind. 27 (non-conformité majeure, audit du 16/10) — le registre des
-- sous-traitants tenu par l'outil pour les formateurs INDÉPENDANTS, et la trace de
-- chaque contrôle fait. Livré ÉTEINT : rien n'écrit dans ces tables tant que
-- l'interrupteur `formateurs.registre_sous_traitants` est coupé.
--
-- ADDITIVE seulement : deux types et deux tables neuves, vides. Aucun DROP, aucune
-- ligne existante touchée. Rien n'est supprimé : les deux clés étrangères vers les
-- fiches sont en RESTRICT (une sortie est un statut daté, jamais une suppression).

-- CreateEnum
CREATE TYPE "statut_registre_sous_traitant" AS ENUM ('actif', 'suspendu', 'sorti');

-- CreateEnum
CREATE TYPE "resultat_controle_sous_traitant" AS ENUM ('conforme', 'non_conforme', 'a_revoir');

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

    CONSTRAINT "controles_sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "registre_sous_traitants_independants_trainer_id_key" ON "registre_sous_traitants_independants"("trainer_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "registre_sous_traitants_independants_sous_traitant_id_key" ON "registre_sous_traitants_independants"("sous_traitant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "registre_sous_traitants_independants_statut_idx" ON "registre_sous_traitants_independants"("statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "controles_sous_traitants_registre_id_code_fait_at_idx" ON "controles_sous_traitants"("registre_id", "code", "fait_at");

-- AddForeignKey
ALTER TABLE "registre_sous_traitants_independants" ADD CONSTRAINT "registre_sous_traitants_independants_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registre_sous_traitants_independants" ADD CONSTRAINT "registre_sous_traitants_independants_sous_traitant_id_fkey" FOREIGN KEY ("sous_traitant_id") REFERENCES "sous_traitants_of"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controles_sous_traitants" ADD CONSTRAINT "controles_sous_traitants_registre_id_fkey" FOREIGN KEY ("registre_id") REFERENCES "registre_sous_traitants_independants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

