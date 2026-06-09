-- Onglet « Toutes les URLs » (2026-06-08) — enrichissement SiteRoute.
-- Additif, non destructif : tous les champs sont nullable ou ont un DEFAULT,
-- aucune donnée existante n'est impactée. Compatible build stub.invalid.

-- Feu tricolore de revue manuelle.
CREATE TYPE "SiteRouteQuality" AS ENUM ('unset', 'green', 'orange', 'red');

ALTER TABLE "site_routes"
  -- Indexabilité LIVE (calculée par le worker de découverte).
  ADD COLUMN "is_indexable" BOOLEAN,
  ADD COLUMN "noindex_reason" VARCHAR(200),
  -- Catégorie canonique de regroupement UI.
  ADD COLUMN "category" VARCHAR(60),
  -- Revue manuelle.
  ADD COLUMN "quality_status" "SiteRouteQuality" NOT NULL DEFAULT 'unset',
  ADD COLUMN "admin_notes" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by" VARCHAR(100),
  -- Google Search Console : demande manuelle + trafic réel.
  ADD COLUMN "gsc_indexation_requested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gsc_indexation_requested_at" TIMESTAMP(3),
  ADD COLUMN "gsc_clicks" INTEGER,
  ADD COLUMN "gsc_impressions" INTEGER,
  ADD COLUMN "gsc_ctr" DOUBLE PRECISION,
  ADD COLUMN "gsc_position" DOUBLE PRECISION,
  ADD COLUMN "gsc_data_at" TIMESTAMP(3),
  -- Cycle de vie « vivant ».
  ADD COLUMN "last_seen_at" TIMESTAMP(3),
  ADD COLUMN "removed_at" TIMESTAMP(3);

CREATE INDEX "site_routes_quality_status_idx" ON "site_routes"("quality_status");
CREATE INDEX "site_routes_is_indexable_idx" ON "site_routes"("is_indexable");
CREATE INDEX "site_routes_gsc_indexation_requested_idx" ON "site_routes"("gsc_indexation_requested");
CREATE INDEX "site_routes_category_idx" ON "site_routes"("category");
CREATE INDEX "site_routes_removed_at_idx" ON "site_routes"("removed_at");
