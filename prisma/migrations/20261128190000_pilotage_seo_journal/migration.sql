-- Pilotage SEO (P13) : journal des modifications. MIGRATION ADDITIVE : une table NOUVELLE et deux
-- index, rejouable (IF NOT EXISTS), aucune table existante touchée, sans clé étrangère.
CREATE TABLE IF NOT EXISTS "seo_modifications" (
    "id" TEXT NOT NULL,
    "cible_type" VARCHAR(40) NOT NULL,
    "cible_id" VARCHAR(120) NOT NULL,
    "url" VARCHAR(1000),
    "champ" VARCHAR(60) NOT NULL,
    "avant" JSONB,
    "apres" JSONB,
    "hash_avant" VARCHAR(64),
    "hash_apres" VARCHAR(64),
    "etat" VARCHAR(20) NOT NULL DEFAULT 'proposee',
    "origine" VARCHAR(40) NOT NULL,
    "raison" VARCHAR(500),
    "cout_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proposee_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliquee_le" TIMESTAMPTZ(3),
    "date_avant" TIMESTAMPTZ(3),
    "decide_par" VARCHAR(80),
    "annule_par" VARCHAR(80),
    "annulee_le" TIMESTAMPTZ(3),
    "mesure_avant" JSONB,
    "mesure_apres" JSONB,
    "groupe" VARCHAR(20),

    CONSTRAINT "seo_modifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seo_modifications_cible_appliquee_idx"
  ON "seo_modifications"("cible_type", "cible_id", "appliquee_le");
CREATE INDEX IF NOT EXISTS "seo_modifications_etat_proposee_idx"
  ON "seo_modifications"("etat", "proposee_le");

-- Une seule modification en cours par cible (proposée ou appliquée).
CREATE UNIQUE INDEX IF NOT EXISTS "seo_modifications_une_en_cours_key"
  ON "seo_modifications"("cible_type", "cible_id")
  WHERE "etat" IN ('proposee', 'appliquee');
