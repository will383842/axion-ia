-- G3 : versions de PDF de guides fabriquées par le site (guides_reseau_versions).
-- ADDITIVE : une nouvelle table, aucune colonne existante modifiée ni supprimée, aucun UPDATE / DELETE / INSERT.
-- Aucune clé étrangère (la table ne dépend d'aucune autre ; le worker ne l'interroge jamais).
-- Retour arrière : rollback.sql (DROP TABLE IF EXISTS) — éteindre GUIDES_RESEAU_FABRIQUE_ENABLED suffit en pratique.
CREATE TABLE "guides_reseau_versions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(28) NOT NULL,
    "version" INTEGER NOT NULL,
    "sha256_texte" CHAR(64) NOT NULL,
    "sha256_pdf" CHAR(64),
    "titre" VARCHAR(120) NOT NULL,
    "pages" INTEGER,
    "taille_octets" INTEGER,
    "stockage" VARCHAR(10) NOT NULL,
    "cle_objet" VARCHAR(80) NOT NULL,
    "statut" VARCHAR(10) NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guides_reseau_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "guides_reseau_versions_code_forme" CHECK ("code" ~ '^gde-[a-z0-9-]{6,24}$'),
    CONSTRAINT "guides_reseau_versions_version_bornes" CHECK ("version" BETWEEN 1 AND 100000),
    CONSTRAINT "guides_reseau_versions_stockage_valeur" CHECK ("stockage" IN ('r2', 'volume')),
    CONSTRAINT "guides_reseau_versions_statut_valeur" CHECK ("statut" IN ('en_cours', 'pret', 'echec'))
);

CREATE UNIQUE INDEX "guides_reseau_versions_code_version_key" ON "guides_reseau_versions"("code", "version");
CREATE INDEX "guides_reseau_versions_code_version_desc_idx" ON "guides_reseau_versions"("code", "version" DESC);
