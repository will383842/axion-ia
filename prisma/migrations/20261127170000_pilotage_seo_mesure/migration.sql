-- Pilotage SEO & GEO, couche « mesure » (P2) : sept tables NOUVELLES, sans clé étrangère,
-- sans énumération Postgres. Ajout seul et rejouable (IF NOT EXISTS) : aucun UPDATE, DELETE,
-- DROP ni ALTER, aucune table existante touchée. Compatible avec les deux conteneurs.

CREATE TABLE IF NOT EXISTS "gsc_import_runs" (
    "id" TEXT NOT NULL,
    "jour" DATE NOT NULL,
    "type_recherche" VARCHAR(20) NOT NULL DEFAULT 'web',
    "statut" VARCHAR(20) NOT NULL DEFAULT 'en_cours',
    "nb_lignes_page" INTEGER NOT NULL DEFAULT 0,
    "nb_lignes_requete" INTEGER NOT NULL DEFAULT 0,
    "tentatives" INTEGER NOT NULL DEFAULT 1,
    "erreur_code" VARCHAR(80),
    "debut_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin_le" TIMESTAMPTZ(3),

    CONSTRAINT "gsc_import_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gsc_page_jours" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "type_recherche" VARCHAR(20) NOT NULL DEFAULT 'web',
    "chemin" VARCHAR(1000) NOT NULL,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "position_sum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions_detaillees" INTEGER NOT NULL DEFAULT 0,
    "requetes_filtrees" INTEGER NOT NULL DEFAULT 0,
    "site_route_id" TEXT,
    "categorie" VARCHAR(40),
    "type_page" VARCHAR(40),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gsc_page_jours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gsc_requetes" (
    "id" SERIAL NOT NULL,
    "texte" VARCHAR(512) NOT NULL,
    "premiere_le" DATE NOT NULL,
    "derniere_le" DATE NOT NULL,

    CONSTRAINT "gsc_requetes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gsc_page_requete_jours" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "type_recherche" VARCHAR(20) NOT NULL DEFAULT 'web',
    "chemin" VARCHAR(1000) NOT NULL,
    "requete_id" INTEGER NOT NULL,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "position_sum" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "gsc_page_requete_jours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gsc_page_requete_semaines" (
    "id" SERIAL NOT NULL,
    "semaine" DATE NOT NULL,
    "type_recherche" VARCHAR(20) NOT NULL DEFAULT 'web',
    "chemin" VARCHAR(1000) NOT NULL,
    "requete_id" INTEGER NOT NULL,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "position_sum" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "gsc_page_requete_semaines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gsc_inspections" (
    "id" TEXT NOT NULL,
    "chemin" VARCHAR(1000) NOT NULL,
    "inspecte_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verdict" VARCHAR(40),
    "couverture" VARCHAR(200),
    "canonique_google" VARCHAR(1000),
    "canonique_declaree" VARCHAR(1000),
    "dernier_passage_robot" TIMESTAMPTZ(3),
    "site_route_id" TEXT,

    CONSTRAINT "gsc_inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seo_opportunites" (
    "id" TEXT NOT NULL,
    "semaine" DATE NOT NULL,
    "detecteur" VARCHAR(60) NOT NULL,
    "cible" VARCHAR(1000) NOT NULL,
    "type_page" VARCHAR(40),
    "categorie" VARCHAR(40),
    "priorite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "etat" VARCHAR(20) NOT NULL DEFAULT 'ouverte',
    "details" JSONB,
    "site_route_id" TEXT,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mis_a_jour_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "seo_opportunites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gsc_import_runs_jour_type_recherche_key" ON "gsc_import_runs"("jour", "type_recherche");
CREATE INDEX IF NOT EXISTS "gsc_import_runs_statut_jour_idx" ON "gsc_import_runs"("statut", "jour");

CREATE UNIQUE INDEX IF NOT EXISTS "gsc_page_jours_date_type_recherche_chemin_key" ON "gsc_page_jours"("date", "type_recherche", "chemin");
CREATE INDEX IF NOT EXISTS "gsc_page_jours_chemin_date_idx" ON "gsc_page_jours"("chemin", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "gsc_requetes_texte_key" ON "gsc_requetes"("texte");
CREATE INDEX IF NOT EXISTS "gsc_requetes_derniere_le_idx" ON "gsc_requetes"("derniere_le");

CREATE UNIQUE INDEX IF NOT EXISTS "gsc_page_requete_jours_cle_key" ON "gsc_page_requete_jours"("date", "type_recherche", "chemin", "requete_id");
CREATE INDEX IF NOT EXISTS "gsc_page_requete_jours_requete_id_date_idx" ON "gsc_page_requete_jours"("requete_id", "date");
CREATE INDEX IF NOT EXISTS "gsc_page_requete_jours_chemin_date_idx" ON "gsc_page_requete_jours"("chemin", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "gsc_page_requete_semaines_cle_key" ON "gsc_page_requete_semaines"("semaine", "type_recherche", "chemin", "requete_id");
CREATE INDEX IF NOT EXISTS "gsc_page_requete_semaines_requete_id_semaine_idx" ON "gsc_page_requete_semaines"("requete_id", "semaine");

CREATE INDEX IF NOT EXISTS "gsc_inspections_chemin_inspecte_le_idx" ON "gsc_inspections"("chemin", "inspecte_le");
CREATE INDEX IF NOT EXISTS "gsc_inspections_inspecte_le_idx" ON "gsc_inspections"("inspecte_le");

CREATE UNIQUE INDEX IF NOT EXISTS "seo_opportunites_semaine_detecteur_cible_key" ON "seo_opportunites"("semaine", "detecteur", "cible");
CREATE INDEX IF NOT EXISTS "seo_opportunites_etat_priorite_idx" ON "seo_opportunites"("etat", "priorite");
