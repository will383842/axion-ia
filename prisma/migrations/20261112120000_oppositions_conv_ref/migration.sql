-- STOP reçu AVANT la validation de la page du guide (fiche MG-STOP01, sécurité des personnes).
-- Le site gardait « référence inconnue : 200, rien d'écrit » : si la personne validait ensuite la page,
-- le guide partait. Cette table garde la MARQUE de la référence de conversation (HMAC, jamais d'adresse).
-- STRICTEMENT ADDITIF : une nouvelle table, aucune colonne existante touchée, aucun UPDATE / DELETE / DROP.
-- Compatible avec l'ANCIEN conteneur (il ignore la table). À atterrir avant le code qui l'écrit ou la lit.
-- Retour arrière : rollback.sql.

-- CreateTable
CREATE TABLE "oppositions_conv_ref" (
    "id" TEXT NOT NULL,
    "conv_ref" VARCHAR(64) NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oppositions_conv_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oppositions_conv_ref_conv_ref_key" ON "oppositions_conv_ref"("conv_ref");
