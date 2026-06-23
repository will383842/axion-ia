-- Observatoire IA 2026 — dashboard pro (2026-06-24).
-- 100 % additif : deux nouvelles tables, aucun drop, aucune colonne requise sur
-- les tables existantes. Les breakdowns par segment vivent dans le JSON existant
-- `barometer_snapshots.payload` (clé `segments`) → pas de changement de schéma là.
--
--   barometer_snapshot_history : 1 ligne par recompute → courbes d'évolution.
--   barometer_analyses         : synthèse LLM en cache (key="latest").

-- CreateTable
CREATE TABLE "barometer_snapshot_history" (
    "id" UUID NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_responses" INTEGER NOT NULL DEFAULT 0,
    "insights" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barometer_snapshot_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barometer_analyses" (
    "id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "based_on_total" INTEGER NOT NULL DEFAULT 0,
    "model" VARCHAR(80),
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barometer_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "barometer_snapshot_history_computed_at_idx" ON "barometer_snapshot_history"("computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "barometer_analyses_key_key" ON "barometer_analyses"("key");
