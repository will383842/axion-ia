-- Page « Recevoir le guide » — lot S0 (2026-11-08) : table des contacts venus d'un réseau.
-- STRICTEMENT ADDITIF : une table neuve, aucune colonne, valeur ou énumération existante touchée,
-- aucun DROP / DELETE. Aucune ligne écrite ici. La clé étrangère vers "guide_requests" vit sur la
-- NOUVELLE table : "guide_requests" n'est pas modifiée.
-- Compatible avec l'ANCIEN conteneur (web ou worker), qui ignore cette table : elle part AVANT
-- tout code qui la lit (S2). Retour arrière : rollback.sql (tables vides seulement).

-- CreateTable
CREATE TABLE "contacts_guide_reseau" (
    "id" TEXT NOT NULL,
    "email_key" VARCHAR(64) NOT NULL,
    "guide_request_id" UUID,
    "prenom" TEXT NOT NULL,
    "mot" VARCHAR(30) NOT NULL,
    "reseau" VARCHAR(20) NOT NULL,
    "compte_ref" VARCHAR(80) NOT NULL,
    "post_ref" VARCHAR(80),
    "version_m1" VARCHAR(64) NOT NULL,
    "version_consentement" VARCHAR(64) NOT NULL,
    "consent_empreinte" CHAR(64) NOT NULL,
    "consenti_le" TIMESTAMPTZ(3) NOT NULL,
    "jeton_empreinte" CHAR(64) NOT NULL,
    "conv_ref" VARCHAR(120) NOT NULL,
    "merci_statut" VARCHAR(20) NOT NULL DEFAULT 'a_envoyer',
    "merci_confirme_le" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contacts_guide_reseau_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_guide_reseau_jeton_empreinte_key" ON "contacts_guide_reseau"("jeton_empreinte");

-- CreateIndex
CREATE INDEX "contacts_guide_reseau_email_key_idx" ON "contacts_guide_reseau"("email_key");

-- CreateIndex
CREATE INDEX "contacts_guide_reseau_merci_statut_created_at_idx" ON "contacts_guide_reseau"("merci_statut", "created_at");

-- CreateIndex
CREATE INDEX "contacts_guide_reseau_guide_request_id_idx" ON "contacts_guide_reseau"("guide_request_id");

-- AddForeignKey
ALTER TABLE "contacts_guide_reseau" ADD CONSTRAINT "contacts_guide_reseau_guide_request_id_fkey" FOREIGN KEY ("guide_request_id") REFERENCES "guide_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
