-- MIGRATION ADDITIVE — Pilotage SEO, P17 : relevé Bing Webmaster Tools par page et par semaine.
-- UNE table NOUVELLE, sans clé étrangère, sans énumération. Ajout seul et rejouable
-- (IF NOT EXISTS) : aucun UPDATE, DELETE, DROP ni ALTER.

CREATE TABLE IF NOT EXISTS "bing_pages_semaine" (
    "id" SERIAL NOT NULL,
    "semaine" DATE NOT NULL,
    "page" VARCHAR(500) NOT NULL,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "position_sum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bing_pages_semaine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bing_pages_semaine_cle_key" ON "bing_pages_semaine"("semaine", "page");
CREATE INDEX IF NOT EXISTS "bing_pages_semaine_semaine_idx" ON "bing_pages_semaine"("semaine");
