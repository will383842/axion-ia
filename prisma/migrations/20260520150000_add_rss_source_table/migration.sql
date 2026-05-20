-- Sprint S+5 P2-3 : migration `ContentGenConfig.key="rss_sources"` JSON inline → table dédiée.
--
-- Le worker `content-rss-fetch-worker` lit désormais depuis `rss_sources`
-- (avec fallback ContentGenConfig 1 release pour rétro-compat). Seeder
-- `prisma/seeds/rss-sources.ts` migre depuis le JSON existant au runtime.
--
-- Verticale = slug parmi `interventions`, `audit`, `implementations`, `un_a_un`
-- (4 verticales canoniques Axion-IA). Nullable pour feeds transverses.

CREATE TABLE "rss_sources" (
    "id"                TEXT NOT NULL,
    "url"               VARCHAR(500) NOT NULL,
    "name"              VARCHAR(200) NOT NULL,
    "enabled"           BOOLEAN NOT NULL DEFAULT true,
    "verticale"         VARCHAR(40),
    "tags"              JSONB NOT NULL DEFAULT '[]',
    "poll_interval_min" INTEGER NOT NULL DEFAULT 60,
    "auto_publish"      BOOLEAN NOT NULL DEFAULT false,
    "language"          VARCHAR(5) NOT NULL DEFAULT 'fr',
    "last_fetched_at"   TIMESTAMP(3),
    "last_success_at"   TIMESTAMP(3),
    "failure_count"     INTEGER NOT NULL DEFAULT 0,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rss_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rss_sources_url_key" ON "rss_sources"("url");
CREATE INDEX "rss_sources_enabled_last_fetched_at_idx" ON "rss_sources"("enabled", "last_fetched_at");
CREATE INDEX "rss_sources_verticale_idx" ON "rss_sources"("verticale");
