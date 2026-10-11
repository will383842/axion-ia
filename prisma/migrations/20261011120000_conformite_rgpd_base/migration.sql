-- ════════════════════════════════════════════════════════════════════════════
-- CONFORMITÉ RGPD — LOT 2 : REGISTRE, ÉCARTS ET INCIDENTS EN BASE (2026-10-11)
--
-- 🔴 ADDITIVE SEULEMENT : trois tables et quatre énumérations NEUVES. Aucune
-- table existante n'est touchée — l'ancien code (fenêtre app/worker) ne les voit
-- pas, le worker ne les lit pas.
--
-- ⛔ Aucune suppression prévue : la clé étrangère écart → traitement est en
-- RESTRICT, et le code n'expose aucun effacement.
-- ════════════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "statut_traitement_rgpd" AS ENUM ('actif', 'archive');

-- CreateEnum
CREATE TYPE "gravite_ecart_rgpd" AS ENUM ('critique', 'eleve', 'moyen', 'faible');

-- CreateEnum
CREATE TYPE "statut_ecart_rgpd" AS ENUM ('ouvert', 'corrige');

-- CreateEnum
CREATE TYPE "statut_incident_donnees" AS ENUM ('ouvert', 'clos');

-- CreateTable
CREATE TABLE "traitements_rgpd" (
    "id" UUID NOT NULL,
    "cle" VARCHAR(80) NOT NULL,
    "nom" VARCHAR(300) NOT NULL,
    "personnes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "donnees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "finalite" TEXT,
    "base_legale" TEXT,
    "conservation_annoncee" TEXT,
    "conservation_reelle" TEXT,
    "destinataires" JSONB NOT NULL DEFAULT '[]',
    "securite" TEXT,
    "droits" TEXT,
    "statut" "statut_traitement_rgpd" NOT NULL DEFAULT 'actif',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "importe_le" TIMESTAMP(3) NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traitements_rgpd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecarts_rgpd" (
    "id" UUID NOT NULL,
    "traitement_id" UUID NOT NULL,
    "code" VARCHAR(200) NOT NULL,
    "gravite" "gravite_ecart_rgpd" NOT NULL,
    "constat" TEXT,
    "correction" TEXT,
    "statut" "statut_ecart_rgpd" NOT NULL DEFAULT 'ouvert',
    "corrige_le" TIMESTAMP(3),
    "corrige_par_id" UUID,
    "corrige_par_nom" VARCHAR(200),
    "note" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecarts_rgpd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents_donnees" (
    "id" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "decouvert_le" TIMESTAMP(3) NOT NULL,
    "survenu_le" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "donnees_concernees" TEXT,
    "nombre_personnes" INTEGER,
    "categories_personnes" TEXT,
    "consequences" TEXT,
    "mesures_prises" TEXT,
    "declare_cnil" BOOLEAN,
    "declare_cnil_le" TIMESTAMP(3),
    "motif_non_declaration" TEXT,
    "personnes_prevenues" BOOLEAN,
    "personnes_prevenues_le" TIMESTAMP(3),
    "motif_non_information" TEXT,
    "statut" "statut_incident_donnees" NOT NULL DEFAULT 'ouvert',
    "clos_le" TIMESTAMP(3),
    "cree_par_id" UUID,
    "cree_par_nom" VARCHAR(200) NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_donnees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traitements_rgpd_cle_key" ON "traitements_rgpd"("cle");

-- CreateIndex
CREATE INDEX "traitements_rgpd_statut_ordre_idx" ON "traitements_rgpd"("statut", "ordre");

-- CreateIndex
CREATE INDEX "ecarts_rgpd_statut_idx" ON "ecarts_rgpd"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "ecarts_rgpd_traitement_id_code_key" ON "ecarts_rgpd"("traitement_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_donnees_numero_key" ON "incidents_donnees"("numero");

-- CreateIndex
CREATE INDEX "incidents_donnees_statut_decouvert_le_idx" ON "incidents_donnees"("statut", "decouvert_le");

-- AddForeignKey
ALTER TABLE "ecarts_rgpd" ADD CONSTRAINT "ecarts_rgpd_traitement_id_fkey" FOREIGN KEY ("traitement_id") REFERENCES "traitements_rgpd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

