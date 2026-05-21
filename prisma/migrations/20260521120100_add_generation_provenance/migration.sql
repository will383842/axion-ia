-- B.4 P1.5 — Table generation_provenance (AI Act art.50 traçabilité LLM).
CREATE TABLE IF NOT EXISTS "generation_provenance" (
    "id"                      TEXT NOT NULL,
    "article_id"              UUID NOT NULL,
    "step"                    VARCHAR(80) NOT NULL,
    "provider"                VARCHAR(40) NOT NULL,
    "model"                   VARCHAR(80) NOT NULL,
    "model_version"           VARCHAR(40),
    "prompt_hash"             VARCHAR(64) NOT NULL,
    "input_tokens"            INTEGER NOT NULL,
    "output_tokens"           INTEGER NOT NULL,
    "cache_read_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost"                    DECIMAL(10,6) NOT NULL,
    "regulation_version"      VARCHAR(40) NOT NULL DEFAULT 'AI-Act-2024/1689',
    "previous_hash"           VARCHAR(64),
    "hash"                    VARCHAR(64) NOT NULL,
    "timestamp"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_provenance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "generation_provenance_article_id_idx"
    ON "generation_provenance"("article_id");

CREATE INDEX IF NOT EXISTS "generation_provenance_timestamp_idx"
    ON "generation_provenance"("timestamp");

ALTER TABLE "generation_provenance"
    ADD CONSTRAINT "generation_provenance_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "articles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
