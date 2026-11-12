-- F1a-bis : catalogue unique de cibles (guide ou adresse) et liaisons mot -> cible
-- (décision de Williams du 12/11/2026 : rien n'est figé dans le code, tout se saisit par l'écran).
-- ADDITIVE : deux nouvelles tables, aucune colonne existante modifiée ni supprimée, aucun UPDATE / DELETE.
-- Retour arrière : rollback.sql (DROP TABLE IF EXISTS).
CREATE TABLE "cibles_reseau" (
    "id" UUID NOT NULL,
    "code" VARCHAR(28) NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "titre" VARCHAR(120) NOT NULL,
    "chemin_pdf" VARCHAR(200),
    "url" VARCHAR(300),
    "version" INTEGER NOT NULL DEFAULT 1,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cibles_reseau_pkey" PRIMARY KEY ("id"),
    -- `guide-ia` : fiche de départ, code déjà écrit sur les demandes (guide_requests.aimant).
    CONSTRAINT "cibles_reseau_code_forme" CHECK ("code" ~ '^(gde|adr)-[a-z0-9-]{6,24}$' OR "code" = 'guide-ia'),
    CONSTRAINT "cibles_reseau_type_valeur" CHECK ("type" IN ('guide', 'adresse')),
    CONSTRAINT "cibles_reseau_titre_longueur" CHECK (char_length("titre") BETWEEN 3 AND 120),
    CONSTRAINT "cibles_reseau_type_champs" CHECK (
        ("type" = 'guide' AND "chemin_pdf" IS NOT NULL AND "url" IS NULL)
        OR ("type" = 'adresse' AND "url" IS NOT NULL AND "chemin_pdf" IS NULL)
    )
);

CREATE UNIQUE INDEX "cibles_reseau_code_key" ON "cibles_reseau"("code");

CREATE TABLE "mots_cibles" (
    "id" UUID NOT NULL,
    "mot" VARCHAR(30) NOT NULL,
    "reseau" VARCHAR(10) NOT NULL,
    "code_cible" VARCHAR(28) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mots_cibles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mots_cibles_mot_forme" CHECK ("mot" ~ '^[a-z0-9]{2,20}$'),
    CONSTRAINT "mots_cibles_reseau_valeur" CHECK ("reseau" IN ('facebook', 'instagram', 'linkedin', 'tiktok', 'tous'))
);

-- Un mot, une cible par réseau ; plusieurs mots peuvent viser la même cible.
CREATE UNIQUE INDEX "mots_cibles_mot_reseau_key" ON "mots_cibles"("mot", "reseau");
CREATE INDEX "mots_cibles_code_cible_idx" ON "mots_cibles"("code_cible");

ALTER TABLE "mots_cibles" ADD CONSTRAINT "mots_cibles_code_cible_fkey"
    FOREIGN KEY ("code_cible") REFERENCES "cibles_reseau"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fiche de départ : le guide déjà proposé (titre et PDF déjà utilisés dans le code). Idempotent.
INSERT INTO "cibles_reseau" ("id", "code", "type", "titre", "chemin_pdf", "version")
VALUES (gen_random_uuid(), 'guide-ia', 'guide', 'Guide IA entreprise', 'imprimes/guide-ia-entreprise-2026-axion-ia.pdf', 1)
ON CONFLICT ("code") DO NOTHING;
