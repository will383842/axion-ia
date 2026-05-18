-- City Domination 2026-05-18 P1-6 + P1-9 — Migration additive atomique.
--
-- 2 chantiers combinés (1 migration atomique pour réduire le risque drift
-- pnpm symlinks observé 2026-05-16) :
--
-- P1-6 (audit A7 P1) — topic_fingerprint sur articles + knowledge_entries
--   SimHash 64-bit hex (VARCHAR(64)) calculé à partir des embeddings Voyage AI.
--   Permet dedup sémantique cross-entry au-delà du Levenshtein/MinHash texte.
--   NULL au début → helper `computeTopicFingerprint()` remplit progressivement.
--   Pas d'index par défaut (faible cardinalité utile au query : un dedup
--   pipeline scan tous les NULL puis compare en batch). Index à ajouter
--   Sprint suivant si query plan devient lent (post Voyage AI activation).
--
-- P1-9 (audit A10) — content_gen_audit_log table SOC2 audit trail
--   Append-only diff oldValue → newValue pour toute écriture ContentGenConfig
--   (+ futures actions admin). Couvre exigence SOC2 forensique.
--   3 indexes : settingKey, actorUserId, action (sort DESC sur created_at).
--
-- Doctrine zero-downtime :
--   - Migration ADDITIVE pure (ADD COLUMN nullable + CREATE TABLE)
--   - Aucune transformation de données existantes
--   - Aucune contrainte FK qui pourrait bloquer
--   - Compatible build externalisé GitHub Actions + stub.invalid (cf AGENTS.md)
--   - Compatible workflow admin-emergency-migrate.yml si besoin rollback


-- ===========================================================================
-- P1-6 — topic_fingerprint ADDITIVE
-- ===========================================================================

ALTER TABLE "articles"
  ADD COLUMN "topic_fingerprint" VARCHAR(64);

ALTER TABLE "knowledge_entries"
  ADD COLUMN "topic_fingerprint" VARCHAR(64);


-- ===========================================================================
-- P1-9 — content_gen_audit_log SOC2 append-only
-- ===========================================================================

CREATE TABLE "content_gen_audit_log" (
  "id"             TEXT NOT NULL,
  "action"         VARCHAR(64) NOT NULL,
  "setting_key"    VARCHAR(128),
  "old_value"      JSONB,
  "new_value"      JSONB,
  "actor_user_id"  UUID,
  "actor_email"    VARCHAR(255),
  "actor_ip"       VARCHAR(64),
  "actor_ua"       VARCHAR(500),
  "description"    TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_gen_audit_log_pkey" PRIMARY KEY ("id")
);

-- Index lookup par setting modifié (drill-down audit forensique)
CREATE INDEX "content_gen_audit_log_setting_key_created_at_idx"
  ON "content_gen_audit_log" ("setting_key", "created_at" DESC);

-- Index lookup par admin (qui a fait quoi quand)
CREATE INDEX "content_gen_audit_log_actor_user_id_created_at_idx"
  ON "content_gen_audit_log" ("actor_user_id", "created_at" DESC);

-- Index lookup par type d'action (volume par action sur fenêtre)
CREATE INDEX "content_gen_audit_log_action_created_at_idx"
  ON "content_gen_audit_log" ("action", "created_at" DESC);
