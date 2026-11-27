-- Chaîne éditoriale IA (C3) : six tables NOUVELLES et une colonne NULLABLE sur cost_ledger.
-- Ajout seul : aucun DROP, UPDATE, DELETE, INSERT, aucune énumération Postgres (statuts, intentions,
-- rôles et codes de raison sont du texte, listes fermées côté code). Rien dans le code de
-- production ne lit ni n'écrit ces tables ni la colonne `role` : compatible avec l'ancien et le
-- nouveau conteneur (app et worker), dans les deux sens.
-- Retour arrière (jamais joué automatiquement) :
--   ALTER TABLE "cost_ledger" DROP COLUMN "role";
--   DROP TABLE IF EXISTS "contenu_refus", "contenu_faits", "contenu_briefs",
--     "contenu_besoins", "contenu_resultats", "contenu_propositions";

-- AlterTable
ALTER TABLE "cost_ledger" ADD COLUMN     "role" VARCHAR(40);

-- CreateTable
CREATE TABLE "contenu_besoins" (
    "id" TEXT NOT NULL,
    "question" VARCHAR(300) NOT NULL,
    "intention" VARCHAR(20),
    "source" VARCHAR(40) NOT NULL,
    "sourceRef" VARCHAR(500),
    "forceSignal" DOUBLE PRECISION,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'nouveau',
    "urlCouverte" VARCHAR(500),
    "raisonEcarte" VARCHAR(40),
    "observeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contenu_besoins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contenu_briefs" (
    "id" TEXT NOT NULL,
    "besoinId" TEXT,
    "jobId" TEXT,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'brouillon',
    "motCle" VARCHAR(200),
    "intentionRecherche" VARCHAR(20),
    "angleUnique" VARCHAR(500),
    "planTitres" JSONB,
    "longueurMinMots" INTEGER,
    "longueurMaxMots" INTEGER,
    "brief" JSONB,
    "versionPrompt" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contenu_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contenu_faits" (
    "id" TEXT NOT NULL,
    "briefId" TEXT,
    "enonce" VARCHAR(1000) NOT NULL,
    "extrait" TEXT NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "editeur" VARCHAR(200),
    "datePublication" TIMESTAMP(3),
    "dateLecture" TIMESTAMP(3) NOT NULL,
    "confiance" VARCHAR(10),
    "statut" VARCHAR(20) NOT NULL DEFAULT 'propose',
    "verifieLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contenu_faits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contenu_refus" (
    "id" TEXT NOT NULL,
    "briefId" TEXT,
    "jobId" TEXT,
    "tentative" INTEGER NOT NULL DEFAULT 1,
    "role" VARCHAR(40) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "critere" VARCHAR(10),
    "detail" TEXT,
    "sectionEnCause" VARCHAR(300),
    "coutDepenseUsd" DECIMAL(10,4),
    "versionPrompt" VARCHAR(60),
    "versionBrief" VARCHAR(60),
    "versionPorte" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contenu_refus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contenu_resultats" (
    "id" TEXT NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "briefId" TEXT,
    "jobId" TEXT,
    "echeance" VARCHAR(10) NOT NULL,
    "mesureLe" TIMESTAMP(3) NOT NULL,
    "indexe" BOOLEAN,
    "affichages" INTEGER,
    "clics" INTEGER,
    "position" DOUBLE PRECISION,
    "affichagesIa" INTEGER,
    "citationsIa" INTEGER,
    "visitesIa" INTEGER,
    "rendezVous" INTEGER,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contenu_resultats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contenu_propositions" (
    "id" TEXT NOT NULL,
    "semaine" DATE NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "role" VARCHAR(40),
    "constat" TEXT NOT NULL,
    "hypothese" TEXT NOT NULL,
    "changement" TEXT NOT NULL,
    "effetAttendu" TEXT,
    "risque" TEXT,
    "critereEvaluation" VARCHAR(300),
    "statut" VARCHAR(20) NOT NULL DEFAULT 'a_relire',
    "decidePar" VARCHAR(120),
    "decideLe" TIMESTAMP(3),
    "templateVersionRef" VARCHAR(100),
    "resultatMesure" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contenu_propositions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contenu_besoins_statut_createdAt_idx" ON "contenu_besoins"("statut", "createdAt");

-- CreateIndex
CREATE INDEX "contenu_briefs_besoinId_idx" ON "contenu_briefs"("besoinId");

-- CreateIndex
CREATE INDEX "contenu_briefs_jobId_idx" ON "contenu_briefs"("jobId");

-- CreateIndex
CREATE INDEX "contenu_briefs_statut_createdAt_idx" ON "contenu_briefs"("statut", "createdAt");

-- CreateIndex
CREATE INDEX "contenu_faits_briefId_idx" ON "contenu_faits"("briefId");

-- CreateIndex
CREATE INDEX "contenu_faits_statut_idx" ON "contenu_faits"("statut");

-- CreateIndex
CREATE INDEX "contenu_refus_briefId_idx" ON "contenu_refus"("briefId");

-- CreateIndex
CREATE INDEX "contenu_refus_code_createdAt_idx" ON "contenu_refus"("code", "createdAt");

-- CreateIndex
CREATE INDEX "contenu_refus_role_createdAt_idx" ON "contenu_refus"("role", "createdAt");

-- CreateIndex
CREATE INDEX "contenu_resultats_briefId_idx" ON "contenu_resultats"("briefId");

-- CreateIndex
CREATE INDEX "contenu_resultats_mesureLe_idx" ON "contenu_resultats"("mesureLe");

-- CreateIndex
CREATE UNIQUE INDEX "contenu_resultats_url_echeance_mesureLe_key" ON "contenu_resultats"("url", "echeance", "mesureLe");

-- CreateIndex
CREATE INDEX "contenu_propositions_semaine_idx" ON "contenu_propositions"("semaine");

-- CreateIndex
CREATE INDEX "contenu_propositions_statut_idx" ON "contenu_propositions"("statut");

-- AddForeignKey
ALTER TABLE "contenu_briefs" ADD CONSTRAINT "contenu_briefs_besoinId_fkey" FOREIGN KEY ("besoinId") REFERENCES "contenu_besoins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contenu_faits" ADD CONSTRAINT "contenu_faits_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "contenu_briefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contenu_refus" ADD CONSTRAINT "contenu_refus_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "contenu_briefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

