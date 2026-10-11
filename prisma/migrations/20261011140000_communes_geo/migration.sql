-- ════════════════════════════════════════════════════════════════════════════
-- FORMATEURS FREELANCE — M-B : référentiel des communes (lot L2c, 2026-10-11)
--
-- ADR 0066. Une table NEUVE, aucune colonne ajoutée ailleurs (en particulier
-- aucune sur `clients` : le lieu d'un client se résout à la lecture).
--
-- 🔴 ADDITIVE SEULEMENT : aucun DROP, aucun RENAME. Aucun code en ligne ne lit
-- cette table avant l'allumage de `formateurs.communes_geo_cron` ; vide, elle
-- ne change rien. Le passage qui la remplit ne supprime jamais une ligne.
-- ════════════════════════════════════════════════════════════════════════════

-- CreateTable
CREATE TABLE "communes_geo" (
    "code_insee" CHAR(5) NOT NULL,
    "nom" VARCHAR(120) NOT NULL,
    "codes_postaux" TEXT[],
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "departement" VARCHAR(3) NOT NULL,
    "population" INTEGER,
    "maj_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communes_geo_pkey" PRIMARY KEY ("code_insee")
);

-- CreateIndex
CREATE INDEX "communes_geo_codes_postaux_idx" ON "communes_geo" USING GIN ("codes_postaux");

-- CreateIndex
CREATE INDEX "communes_geo_departement_idx" ON "communes_geo"("departement");
