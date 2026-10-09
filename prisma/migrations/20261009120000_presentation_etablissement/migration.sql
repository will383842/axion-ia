-- Contrat 2.6 (2026-10-09) : l'attribution porte sur l'ÉTABLISSEMENT déclaré (SIRET) ; Williams
-- peut l'étendre à toute l'entreprise (art. 3.1). Tables séparées, sans clé étrangère déclarée,
-- comme `apporteur_reseau_siret` : aucune requête existante n'en dépend (fenêtre app/worker).
-- Une présentation sans ligne est d'avant la 2.6 : elle couvre l'entreprise. Ajout seul.
CREATE TABLE "presentation_etablissement" (
    "presentation_id" UUID NOT NULL,
    "siret" CHAR(14) NOT NULL,
    "entreprise" BOOLEAN NOT NULL DEFAULT false,
    "etendue_at" TIMESTAMPTZ(3),
    "exclus" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presentation_etablissement_pkey" PRIMARY KEY ("presentation_id")
);

CREATE INDEX "presentation_etablissement_siret_idx" ON "presentation_etablissement"("siret");

-- Une commande dont l'établissement ne correspond à aucune attribution exacte : choix de Williams.
CREATE TABLE "commande_a_attribuer" (
    "facture_id" UUID NOT NULL,
    "siren" CHAR(9) NOT NULL,
    "siret" CHAR(14),
    "candidats" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cree_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "presentation_id" UUID,
    "aucune" BOOLEAN NOT NULL DEFAULT false,
    "decidee_at" TIMESTAMPTZ(3),
    "decidee_par" UUID,

    CONSTRAINT "commande_a_attribuer_pkey" PRIMARY KEY ("facture_id")
);

-- Le SIRET de l'établissement qui commande, porté par le devis (facultatif).
CREATE TABLE "devis_etablissement" (
    "devis_id" UUID NOT NULL,
    "siret" CHAR(14) NOT NULL,
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devis_etablissement_pkey" PRIMARY KEY ("devis_id")
);
