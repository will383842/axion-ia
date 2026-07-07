-- Chantier « Excellence formations » : paramètres pédagogiques enrichissant la
-- génération IA. ADDITIF — colonnes NULLABLE ou avec DEFAULT (aucune donnée
-- existante impactée). Idempotent (IF NOT EXISTS) pour resiliency.

-- Enum niveau
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NiveauFormation') THEN
    CREATE TYPE "NiveauFormation" AS ENUM ('debutant', 'intermediaire', 'avance', 'tous_niveaux');
  END IF;
END$$;

ALTER TABLE "formations"
  ADD COLUMN IF NOT EXISTS "niveau" "NiveauFormation" NOT NULL DEFAULT 'tous_niveaux',
  ADD COLUMN IF NOT EXISTS "prerequis" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "secteur_cible" VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "outils_client" TEXT NOT NULL DEFAULT '';
