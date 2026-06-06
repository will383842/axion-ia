-- T12 Qualiopi — Conformité : registres (réclamations, veille, partenariats,
-- sous-traitants OF, revue direction). off.23/24/25/27/31/32. Migration ADDITIVE
-- uniquement : 3 enums + 5 tables + index. Indicateurs/pilotage/mode auditeur =
-- calculés (pas de table). Dérive préexistante IGNORÉE.

-- CreateEnum
CREATE TYPE "ReclamationSource" AS ENUM ('stagiaire', 'client', 'financeur', 'autre');

-- CreateEnum
CREATE TYPE "ReclamationStatut" AS ENUM ('nouvelle', 'en_cours', 'resolue', 'cloturee');

-- CreateEnum
CREATE TYPE "VeilleType" AS ENUM ('legale', 'metiers', 'pedagogique', 'handicap');

-- CreateTable
CREATE TABLE "reclamations" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "source" "ReclamationSource" NOT NULL,
    "reclamant_nom" VARCHAR(200) NOT NULL,
    "reclamant_email" VARCHAR(255),
    "objet" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL,
    "gravite" VARCHAR(20),
    "statut" "ReclamationStatut" NOT NULL DEFAULT 'nouvelle',
    "date_reception" TIMESTAMP(3) NOT NULL,
    "date_reponse" TIMESTAMP(3),
    "reponse" TEXT,
    "actions_correctives" TEXT,
    "enrollment_id" UUID,
    "traitee_par_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reclamations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veilles" (
    "id" UUID NOT NULL,
    "type" "VeilleType" NOT NULL,
    "source" VARCHAR(300) NOT NULL,
    "titre" VARCHAR(300) NOT NULL,
    "contenu" TEXT NOT NULL,
    "date_veille" TIMESTAMP(3) NOT NULL,
    "impact" TEXT,
    "action_decidee" TEXT,
    "cree_par_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veilles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenariats" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(250) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "objet" TEXT NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partenariats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sous_traitants_of" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(250) NOT NULL,
    "siret" VARCHAR(20),
    "nda" VARCHAR(20),
    "objet_prestation" TEXT NOT NULL,
    "verifie_data_gouv_at" TIMESTAMP(3),
    "contrat_signe_at" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sous_traitants_of_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revues_direction" (
    "id" UUID NOT NULL,
    "annee" INTEGER NOT NULL,
    "date_revue" TIMESTAMP(3) NOT NULL,
    "participants" JSONB NOT NULL DEFAULT '[]',
    "indicateurs_snapshot" JSONB NOT NULL DEFAULT '{}',
    "decisions" JSONB NOT NULL DEFAULT '[]',
    "plan_actions" JSONB NOT NULL DEFAULT '[]',
    "statut" VARCHAR(20) NOT NULL DEFAULT 'brouillon',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revues_direction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reclamations_numero_key" ON "reclamations"("numero");

-- CreateIndex
CREATE INDEX "reclamations_statut_idx" ON "reclamations"("statut");

-- CreateIndex
CREATE INDEX "reclamations_date_reception_idx" ON "reclamations"("date_reception");

-- CreateIndex
CREATE INDEX "veilles_type_idx" ON "veilles"("type");

-- CreateIndex
CREATE INDEX "veilles_date_veille_idx" ON "veilles"("date_veille");

-- CreateIndex
CREATE INDEX "partenariats_actif_idx" ON "partenariats"("actif");

-- CreateIndex
CREATE INDEX "sous_traitants_of_actif_idx" ON "sous_traitants_of"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "revues_direction_annee_key" ON "revues_direction"("annee");
