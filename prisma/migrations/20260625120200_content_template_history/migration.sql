-- Fondation P1/P2 (2026-06-25) — additif uniquement.
-- ContentTemplateHistory : versionnage (snapshot) des prompts ContentTemplate.
-- 1 row par version éditée. FK CASCADE depuis content_templates.id (cuid/TEXT).
-- Idempotent.
CREATE TABLE IF NOT EXISTS "content_template_history" (
    "id"                   TEXT NOT NULL,
    "template_id"          TEXT NOT NULL,
    "version"              INTEGER NOT NULL,
    "system_prompt"        TEXT,
    "user_prompt_template" TEXT,
    "output_schema_zod"    TEXT,
    "model"                TEXT,
    "default_temperature"  DECIMAL(3,2),
    "default_max_tokens"   INTEGER,
    "changed_by"           TEXT,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_template_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_template_history_template_id_version_key"
    ON "content_template_history"("template_id", "version");

CREATE INDEX IF NOT EXISTS "content_template_history_template_id_idx"
    ON "content_template_history"("template_id");

-- FK: ContentTemplateHistory -> ContentTemplate
ALTER TABLE "content_template_history"
    ADD CONSTRAINT "content_template_history_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "content_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
