-- Pilotage SEO & GEO, P11 : réponses du panel GEO (questions posées à Claude + web_search).
-- UNE table NOUVELLE, sans clé étrangère, sans énumération Postgres. Ajout seul et rejouable
-- (IF NOT EXISTS) : aucun UPDATE, DELETE, DROP ni ALTER. Pas de texte intégral de réponse.

CREATE TABLE IF NOT EXISTS "geo_panel_reponses" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "question_id" VARCHAR(20) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "moteur" VARCHAR(40) NOT NULL,
    "question" VARCHAR(300) NOT NULL,
    "urls_citees" JSONB NOT NULL DEFAULT '[]',
    "domaines_cites" JSONB NOT NULL DEFAULT '[]',
    "presente" BOOLEAN NOT NULL DEFAULT false,
    "rang" INTEGER,
    "nb_recherches" INTEGER NOT NULL DEFAULT 0,
    "cout_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_panel_reponses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "geo_panel_reponses_cle_key" ON "geo_panel_reponses"("date", "question_id", "version", "moteur");
CREATE INDEX IF NOT EXISTS "geo_panel_reponses_date_idx" ON "geo_panel_reponses"("date");
