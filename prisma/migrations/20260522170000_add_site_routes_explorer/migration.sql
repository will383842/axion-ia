-- Sprint Site Explorer Admin 2026-05-22
-- Catalogue exhaustif des URLs publiques + détection anomalies.
-- RÈGLE STRICTE : visibility = 'public' uniquement (admin/api_only omis par design).

-- Enums
CREATE TYPE "SiteRouteType" AS ENUM ('static', 'dynamic_template', 'dynamic_db', 'dynamic_filesystem');
CREATE TYPE "SiteRouteStatus" AS ENUM ('live', 'draft', 'preview', 'not_found', 'redirect', 'error', 'unknown');
CREATE TYPE "SiteRouteVisibility" AS ENUM ('public');

-- Table site_routes
CREATE TABLE "site_routes" (
    "id"                   TEXT NOT NULL,
    "path_pattern"         VARCHAR(1000) NOT NULL,
    "path_rendered"        VARCHAR(1000),
    "path_slug"            VARCHAR(500),
    "type"                 "SiteRouteType" NOT NULL,
    "status"               "SiteRouteStatus" NOT NULL DEFAULT 'unknown',
    "visibility"           "SiteRouteVisibility" NOT NULL DEFAULT 'public',
    "source"               VARCHAR(200) NOT NULL,
    "file_path"            VARCHAR(500),
    "parent_route_id"      TEXT,
    "depth"                INTEGER NOT NULL DEFAULT 0,
    "section"              VARCHAR(100),
    "verticales"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "city_ids"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "http_status"          INTEGER,
    "meta_title"           VARCHAR(500),
    "meta_description"     TEXT,
    "h1"                   VARCHAR(500),
    "word_count"           INTEGER,
    "json_ld_count"        INTEGER,
    "internal_link_count"  INTEGER,
    "external_link_count"  INTEGER,
    "has_ai_disclaimer"    BOOLEAN,
    "last_modified_at"     TIMESTAMP(3),
    "last_inspected_at"    TIMESTAMP(3),
    "lighthouse_perf"      INTEGER,
    "lighthouse_seo"       INTEGER,
    "lighthouse_a11y"      INTEGER,
    "lighthouse_bp"        INTEGER,
    "lighthouse_run_at"    TIMESTAMP(3),
    "editable"             BOOLEAN NOT NULL DEFAULT false,
    "editor_route"         VARCHAR(500),
    "source_db_table"      VARCHAR(100),
    "source_db_id"         VARCHAR(100),
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_routes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "site_routes_path_pattern_path_slug_key" UNIQUE ("path_pattern", "path_slug")
);

ALTER TABLE "site_routes" ADD CONSTRAINT "site_routes_parent_route_id_fkey"
    FOREIGN KEY ("parent_route_id") REFERENCES "site_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "site_routes_type_idx"       ON "site_routes"("type");
CREATE INDEX "site_routes_status_idx"     ON "site_routes"("status");
CREATE INDEX "site_routes_section_idx"    ON "site_routes"("section");
CREATE INDEX "site_routes_visibility_idx" ON "site_routes"("visibility");
CREATE INDEX "site_routes_depth_idx"      ON "site_routes"("depth");
CREATE INDEX "site_routes_editable_idx"   ON "site_routes"("editable");

-- Table site_route_anomalies
CREATE TABLE "site_route_anomalies" (
    "id"             TEXT NOT NULL,
    "site_route_id"  TEXT NOT NULL,
    "type"           VARCHAR(100) NOT NULL,
    "severity"       VARCHAR(20) NOT NULL,
    "description"    TEXT NOT NULL,
    "detected_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at"    TIMESTAMP(3),

    CONSTRAINT "site_route_anomalies_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "site_route_anomalies" ADD CONSTRAINT "site_route_anomalies_site_route_id_fkey"
    FOREIGN KEY ("site_route_id") REFERENCES "site_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "site_route_anomalies_site_route_id_idx" ON "site_route_anomalies"("site_route_id");
CREATE INDEX "site_route_anomalies_type_idx"          ON "site_route_anomalies"("type");
CREATE INDEX "site_route_anomalies_severity_idx"      ON "site_route_anomalies"("severity");
CREATE INDEX "site_route_anomalies_resolved_at_idx"   ON "site_route_anomalies"("resolved_at");
