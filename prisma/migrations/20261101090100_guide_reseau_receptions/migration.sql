-- PV-1 (2026-11-01) — journal d'idempotence des demandes de guide venues d'un réseau.
-- STRICTEMENT ADDITIF : une table neuve, aucune colonne ni valeur existante touchée ;
-- le worker n'y touche pas. Aucune adresse e-mail n'y est écrite.
-- Retour arrière (JAMAIS exécuté par défaut) : DROP TABLE "guide_reseau_receptions";

-- CreateTable
CREATE TABLE "guide_reseau_receptions" (
    "id" UUID NOT NULL,
    "cle_idempotence" VARCHAR(80) NOT NULL,
    "nonce" CHAR(32) NOT NULL,
    "corps_sha256" CHAR(64) NOT NULL,
    "reponse_statut" INTEGER NOT NULL,
    "reponse_corps" JSONB NOT NULL,
    "recue_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_reseau_receptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guide_reseau_receptions_cle_idempotence_key" ON "guide_reseau_receptions"("cle_idempotence");

-- CreateIndex
CREATE UNIQUE INDEX "guide_reseau_receptions_nonce_key" ON "guide_reseau_receptions"("nonce");

-- CreateIndex
CREATE INDEX "guide_reseau_receptions_recue_le_idx" ON "guide_reseau_receptions"("recue_le");
