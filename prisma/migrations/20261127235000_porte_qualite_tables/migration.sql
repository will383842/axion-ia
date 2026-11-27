-- Porte qualité des contenus, PR Q1 (CONCEPTION-PORTE-QUALITE.md § 13 et § 15).
-- Ajout seul : deux tables NOUVELLES, leurs index, et une ligne de réglages (ON CONFLICT DO NOTHING).
-- Aucun ALTER, UPDATE, DELETE ni DROP sur une table existante, aucune énumération, aucune
-- clé étrangère. Compatible avec l'ancien et le nouveau conteneur : ni l'app ni le worker ne
-- lisent ni n'écrivent ces tables en Q1 (le code qui le fera tolérera une table absente, P2021).
-- Réglages `porte_qualite` : valeurs de la PHASE D'OBSERVATION (mode ombre, rien ne bloque,
-- toute publication en relecture humaine). Rien ne les lit encore ; les relever est une
-- décision de Will (§ 10). Le plafond est une limite haute, jamais un objectif.

-- CreateTable
CREATE TABLE "content_quality_verdicts" (
    "id" TEXT NOT NULL,
    "job_id" TEXT,
    "article_id" UUID,
    "content_kind" VARCHAR(40) NOT NULL,
    "version_porte" VARCHAR(40) NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "verdict" VARCHAR(20) NOT NULL,
    "note" INTEGER,
    "criteres" JSONB,
    "seuils_figes" JSONB,
    "embedding_voisin_id" TEXT,
    "cosinus_max" DOUBLE PRECISION,
    "decide_par" TEXT,
    "motif_derogation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_quality_verdicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "porte_cohortes" (
    "id" TEXT NOT NULL,
    "semaine" DATE NOT NULL,
    "publies" INTEGER,
    "indexes_7j" INTEGER,
    "indexes_14j" INTEGER,
    "indexes_28j" INTEGER,
    "impressions" INTEGER,
    "note_moyenne" DOUBLE PRECISION,
    "derogations" INTEGER,
    "version_porte" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "porte_cohortes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_quality_verdicts_job_id_idx" ON "content_quality_verdicts"("job_id");

-- CreateIndex
CREATE INDEX "content_quality_verdicts_article_id_idx" ON "content_quality_verdicts"("article_id");

-- CreateIndex
CREATE INDEX "content_quality_verdicts_verdict_created_at_idx" ON "content_quality_verdicts"("verdict", "created_at");

-- CreateIndex
CREATE INDEX "content_quality_verdicts_created_at_idx" ON "content_quality_verdicts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "porte_cohortes_semaine_key" ON "porte_cohortes"("semaine");


-- Réglages par défaut (clé unique `porte_qualite`, § 12.1). Une valeur déjà posée est conservée.
INSERT INTO "content_gen_config" ("id", "key", "value", "description", "updatedAt", "updatedBy")
VALUES (
    'cfg_porte_qualite_v1',
    'porte_qualite',
    '{"versionPorte":"v1","phase":"observation","mode":"ombre","seuilPublication":85,"seuilPublicationRelevee":90,"seuilBloque":70,"plafondSecuriteParJour":3,"relectureHumainePct":100,"indexationMinPct":70,"indexationCoupeCircuitPct":50,"derogationAlertePct":5,"derogationCoupeCircuitPct":10}'::jsonb,
    'Porte qualité : réglages de la phase d''observation (mode ombre, plafond de sécurité bas, relecture humaine à 100 %). Limite haute, jamais un objectif.',
    CURRENT_TIMESTAMP,
    'migration:porte_qualite_q1'
)
ON CONFLICT ("key") DO NOTHING;
