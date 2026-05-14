-- KB V4 (Sprint KB-17) — Journal d'audit immuable append-only.

CREATE TABLE "knowledge_audit_log" (
    "id" BIGSERIAL NOT NULL,
    "event_kind" VARCHAR(60) NOT NULL,
    "entry_id" UUID,
    "actor" VARCHAR(120) NOT NULL,
    "payload_json" JSONB NOT NULL,
    "prev_hash" VARCHAR(64),
    "self_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_audit_log_event_kind_created_at_idx"
  ON "knowledge_audit_log"("event_kind", "created_at");

CREATE INDEX "knowledge_audit_log_entry_id_idx"
  ON "knowledge_audit_log"("entry_id");

CREATE INDEX "knowledge_audit_log_actor_idx"
  ON "knowledge_audit_log"("actor");

-- Append-only enforcement : revoke UPDATE/DELETE pour role applicatif standard.
-- V2 : créer rôle DB dédié et exécuter REVOKE ici. V1 : enforcement code-side.
COMMENT ON TABLE "knowledge_audit_log" IS 'KB V4 Sprint KB-17 — Append-only, chain hash. Ne JAMAIS UPDATE/DELETE.';
