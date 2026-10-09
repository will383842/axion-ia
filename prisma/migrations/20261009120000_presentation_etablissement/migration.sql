-- Contrat 2.6 (2026-10-09) : l'attribution porte sur l'ÉTABLISSEMENT déclaré (SIRET) ; Williams
-- peut l'étendre à toute l'entreprise (art. 3.1). Table séparée, sans clé étrangère déclarée, comme
-- `apporteur_reseau_siret` : aucune requête existante sur `presentations_entreprise` n'en dépend
-- (fenêtre app/worker). Une présentation sans ligne est d'avant la 2.6 : elle couvre l'entreprise.
-- Ajout seul.
CREATE TABLE "presentation_etablissement" (
    "presentation_id" UUID NOT NULL,
    "siret" CHAR(14) NOT NULL,
    "entreprise" BOOLEAN NOT NULL DEFAULT false,
    "etendue_at" TIMESTAMPTZ(3),
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presentation_etablissement_pkey" PRIMARY KEY ("presentation_id")
);

CREATE INDEX "presentation_etablissement_siret_idx" ON "presentation_etablissement"("siret");
