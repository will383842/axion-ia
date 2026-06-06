-- T17 Qualiopi — Durcissement conformité (audit end-to-end).
-- off.2 (indicateurs publiés + méthode sur Formation), off.27 (capture data.gouv
-- datée sur sous-traitant), DREETS/BPF (dépenses). Migration ADDITIVE :
-- colonnes nullables/à-défaut + 1 table. Dérive préexistante IGNORÉE.

-- AlterTable formations (off.2 — indicateurs de résultats publiés)
ALTER TABLE "formations" ADD COLUMN     "indicateurs_publies" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "indicateurs_publies_at" TIMESTAMP(3),
ADD COLUMN     "methode_calcul_indicateurs" TEXT NOT NULL DEFAULT '';

-- AlterTable sous_traitants_of (off.27 — capture datée data.gouv.fr)
ALTER TABLE "sous_traitants_of" ADD COLUMN     "screenshot_date" TIMESTAMP(3),
ADD COLUMN     "screenshot_url" TEXT;

-- CreateTable (BPF — dépenses DREETS)
CREATE TABLE "bpf_depenses" (
    "id" UUID NOT NULL,
    "annee" INTEGER NOT NULL,
    "categorie" VARCHAR(80) NOT NULL,
    "libelle" VARCHAR(250) NOT NULL,
    "montant_ht_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bpf_depenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bpf_depenses_annee_idx" ON "bpf_depenses"("annee");
