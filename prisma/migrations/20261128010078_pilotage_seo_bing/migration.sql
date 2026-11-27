-- Pilotage SEO & GEO, P17 « Bing Webmaster » : trois tables NOUVELLES, sans clé étrangère, sans
-- énumération Postgres. Ajout seul et rejouable (IF NOT EXISTS) : aucun UPDATE, DELETE, DROP ni
-- ALTER, aucune table existante touchée. Compatible avec les deux conteneurs.

CREATE TABLE IF NOT EXISTS "bing_page_semaines" (
    "id" SERIAL NOT NULL,
    "semaine" DATE NOT NULL,
    "chemin" VARCHAR(1000) NOT NULL,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "position_sum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mis_a_jour_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bing_page_semaines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bing_requete_semaines" (
    "id" SERIAL NOT NULL,
    "semaine" DATE NOT NULL,
    "texte" VARCHAR(512) NOT NULL,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "position_sum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mis_a_jour_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bing_requete_semaines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bing_exploration_jours" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "pages_explorees" INTEGER NOT NULL DEFAULT 0,
    "erreurs_exploration" INTEGER NOT NULL DEFAULT 0,
    "pages_indexees" INTEGER NOT NULL DEFAULT 0,
    "codes_4xx" INTEGER NOT NULL DEFAULT 0,
    "codes_5xx" INTEGER NOT NULL DEFAULT 0,
    "mis_a_jour_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bing_exploration_jours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bing_page_semaines_semaine_chemin_key" ON "bing_page_semaines"("semaine", "chemin");
CREATE INDEX IF NOT EXISTS "bing_page_semaines_chemin_semaine_idx" ON "bing_page_semaines"("chemin", "semaine");
CREATE UNIQUE INDEX IF NOT EXISTS "bing_requete_semaines_semaine_texte_key" ON "bing_requete_semaines"("semaine", "texte");
CREATE UNIQUE INDEX IF NOT EXISTS "bing_exploration_jours_date_key" ON "bing_exploration_jours"("date");
