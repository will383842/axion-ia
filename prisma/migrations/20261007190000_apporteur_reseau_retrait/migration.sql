-- Apporteur RETIRÉ du réseau (2026-10-07). Table séparée, sans clé étrangère déclarée :
-- aucune requête existante sur `apporteurs_reseau` n'en dépend (fenêtre app/worker).
CREATE TABLE "apporteur_reseau_retrait" (
    "apporteur_id" UUID NOT NULL,
    "retire_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retire_par" VARCHAR(64),

    CONSTRAINT "apporteur_reseau_retrait_pkey" PRIMARY KEY ("apporteur_id")
);
