-- KB V4 (Sprint KB-13 V4 pré-requis) — Source tracking factory.
-- §17.5/§17.7 prompt master : audit immuable + remontée source en cas de problème.

ALTER TABLE "knowledge_entries"
  ADD COLUMN IF NOT EXISTS "source_factory_id" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "source_prompt_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "source_model_used" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "source_cost_cents" INTEGER,
  ADD COLUMN IF NOT EXISTS "source_generated_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "knowledge_entries_source_factory_id_idx"
  ON "knowledge_entries"("source_factory_id");
