-- B.5 P1.5 — Table keywords (seeds rotation pipeline article generation).
CREATE TABLE IF NOT EXISTS "keywords" (
    "id"               TEXT NOT NULL,
    "term"             VARCHAR(255) NOT NULL,
    "term_normalized"  VARCHAR(255) NOT NULL,
    "vertical"         VARCHAR(60) NOT NULL,
    "search_intent"    VARCHAR(40),
    "is_long_tail"     BOOLEAN NOT NULL DEFAULT false,
    "is_local"         BOOLEAN NOT NULL DEFAULT false,
    "city_ids"         TEXT[] NOT NULL DEFAULT '{}',
    "search_volume"    INTEGER,
    "difficulty"       INTEGER,
    "cluster_id"       VARCHAR(60),
    "usage_count"      INTEGER NOT NULL DEFAULT 0,
    "last_used_at"     TIMESTAMP(3),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "keywords_term_key" ON "keywords"("term");

CREATE INDEX IF NOT EXISTS "keywords_vertical_idx" ON "keywords"("vertical");

CREATE INDEX IF NOT EXISTS "keywords_usage_count_last_used_at_idx"
    ON "keywords"("usage_count", "last_used_at");
