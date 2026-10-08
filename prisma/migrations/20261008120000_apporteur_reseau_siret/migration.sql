-- SIRET de l'établissement sous lequel l'apporteur apporte des affaires (2026-10-08) : une même
-- personne peut avoir plusieurs activités (un SIREN, plusieurs SIRET). Table séparée, sans clé
-- étrangère déclarée, comme `apporteur_reseau_retrait` : aucune requête existante sur
-- `apporteurs_reseau` n'en dépend (fenêtre app/worker). Ajout seul.
CREATE TABLE "apporteur_reseau_siret" (
    "apporteur_id" UUID NOT NULL,
    "siret" CHAR(14) NOT NULL,
    "maj_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apporteur_reseau_siret_pkey" PRIMARY KEY ("apporteur_id")
);
