-- F1a : catalogue des adresses de page ciblables par un mot (décision de Williams du 12/11/2026).
-- ADDITIVE : une nouvelle table, aucune colonne existante modifiée ni supprimée, aucun UPDATE / DELETE.
-- Retour arrière : rollback.sql (DROP TABLE IF EXISTS).
CREATE TABLE "cibles_adresses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(28) NOT NULL,
    "titre" VARCHAR(120) NOT NULL,
    "url" VARCHAR(300) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cibles_adresses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cibles_adresses_code_key" ON "cibles_adresses"("code");
