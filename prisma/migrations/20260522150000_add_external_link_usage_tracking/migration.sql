-- ============================================================
-- EXTERNAL LINKS USAGE TRACKING — Rotation équitable
-- Sprint External Links Database 2026-05-22
-- Cf. src/data/external-links/helpers.ts trackExternalLinksUsage()
-- ============================================================

CREATE TABLE "external_link_usage" (
    "id"                  TEXT NOT NULL,
    "external_link_id"    VARCHAR(120) NOT NULL,
    "usage_count"         INTEGER NOT NULL DEFAULT 0,
    "month_usage_count"   INTEGER NOT NULL DEFAULT 0,
    "last_used_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "month_reset_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_link_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_link_usage_external_link_id_key"
  ON "external_link_usage"("external_link_id");

CREATE INDEX "external_link_usage_external_link_id_idx"
  ON "external_link_usage"("external_link_id");

CREATE INDEX "external_link_usage_last_used_at_idx"
  ON "external_link_usage"("last_used_at");

CREATE INDEX "external_link_usage_usage_count_idx"
  ON "external_link_usage"("usage_count");
