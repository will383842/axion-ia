-- L3b (2026-11-03) — historique d'origine des demandes de guide venues d'un réseau (contrat v3).
-- STRICTEMENT ADDITIF : une table neuve, aucune colonne ni valeur existante touchée, aucune
-- énumération. Compatible avec l'ANCIEN conteneur (qui ne la connaît pas) : worker avant app.
-- Aucune adresse e-mail, aucun pseudo, aucun texte n'y est écrit.
-- Retour arrière (JAMAIS exécuté par défaut) : DROP TABLE "guide_reseau_origines";

-- CreateTable
CREATE TABLE "guide_reseau_origines" (
    "id" UUID NOT NULL,
    "email_key" VARCHAR(64) NOT NULL,
    "cle_dedoublonnage" CHAR(64) NOT NULL,
    "mot" VARCHAR(30) NOT NULL,
    "reseau" VARCHAR(20) NOT NULL,
    "guide" VARCHAR(40) NOT NULL,
    "post_ref" VARCHAR(80),
    "post_url" VARCHAR(300),
    "canal" VARCHAR(16),
    "famille" VARCHAR(40),
    "detail" VARCHAR(60),
    "compte" VARCHAR(40),
    "version_texte" VARCHAR(64),
    "utm_campaign" VARCHAR(60),
    "commentaire_ref_hmac" CHAR(64),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "archivee_le" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_reseau_origines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guide_reseau_origines_dedoublonnage_key" ON "guide_reseau_origines"("email_key", "cle_dedoublonnage");

-- CreateIndex
CREATE INDEX "guide_reseau_origines_personne_date_idx" ON "guide_reseau_origines"("email_key", "occurred_at");
