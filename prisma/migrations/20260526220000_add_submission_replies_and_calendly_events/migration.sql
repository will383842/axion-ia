-- Migration: add_submission_replies_and_calendly_events
-- Sprint Notif Infra 2026-05-26 — Phase 4 / Chantiers 3 + 5.
--
-- Additif strict (cf. AGENTS.md drift contract) :
--   - PAS de DROP de col/table
--   - PAS de RENAME
--   - PAS de NOT NULL sans DEFAULT
--   - Tous les indexes sont créés avec IF NOT EXISTS pour idempotence.

-- ============================================================
-- 1) Extensions de table `submissions` (Chantier 5 reply system)
-- ============================================================

ALTER TABLE "submissions"
    ADD COLUMN IF NOT EXISTS "reply_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "first_replied_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "last_replied_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "needs_attention" BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "submissions_needs_attention_archived_at_idx"
    ON "submissions" ("needs_attention", "archived_at");
CREATE INDEX IF NOT EXISTS "submissions_last_replied_at_idx"
    ON "submissions" ("last_replied_at");

-- ============================================================
-- 2) Enum `submission_reply_status` + table `submission_replies`
-- ============================================================

DO $$ BEGIN
    CREATE TYPE "submission_reply_status" AS ENUM (
        'pending', 'sent', 'delivered', 'bounced', 'complained', 'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "submission_replies" (
    "id"                  TEXT NOT NULL,
    "submission_id"       UUID NOT NULL,
    "replied_by_user_id"  UUID,
    "replied_by_name"     VARCHAR(255) NOT NULL,
    "replied_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "to_email"            CITEXT NOT NULL,
    "subject"             VARCHAR(500) NOT NULL,
    "body_html"           TEXT NOT NULL,
    "body_text"           TEXT NOT NULL,
    "delivery_status"     "submission_reply_status" NOT NULL DEFAULT 'pending',
    "provider_message_id" VARCHAR(500),
    "sent_at"             TIMESTAMP(3),
    "failed_at"           TIMESTAMP(3),
    "error_msg"           TEXT,
    "retry_count"         INTEGER NOT NULL DEFAULT 0,
    "template_used"       VARCHAR(40),
    "internal_note"       TEXT,
    CONSTRAINT "submission_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "submission_replies_submission_id_idx"
    ON "submission_replies" ("submission_id");
CREATE INDEX IF NOT EXISTS "submission_replies_delivery_status_idx"
    ON "submission_replies" ("delivery_status");
CREATE INDEX IF NOT EXISTS "submission_replies_replied_at_idx"
    ON "submission_replies" ("replied_at");

-- Foreign keys (idempotent : DROP CONSTRAINT IF EXISTS puis ADD).
DO $$ BEGIN
    ALTER TABLE "submission_replies"
        ADD CONSTRAINT "submission_replies_submission_id_fkey"
        FOREIGN KEY ("submission_id") REFERENCES "submissions"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "submission_replies"
        ADD CONSTRAINT "submission_replies_replied_by_user_id_fkey"
        FOREIGN KEY ("replied_by_user_id") REFERENCES "admin_users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3) Enums + table `calendly_events` (Chantier 3 Calendly Embed JS)
-- ============================================================

DO $$ BEGIN
    CREATE TYPE "calendly_event_status" AS ENUM (
        'scheduled', 'canceled', 'completed', 'no_show'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "calendly_event_source" AS ENUM (
        'embed_js', 'manual_import', 'webhook'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "calendly_events" (
    "id"                   TEXT NOT NULL,
    "event_type_name"      VARCHAR(255) NOT NULL,
    "event_type_slug"      VARCHAR(100) NOT NULL,
    "status"               "calendly_event_status" NOT NULL DEFAULT 'scheduled',
    "start_time"           TIMESTAMP(3),
    "end_time"             TIMESTAMP(3),
    "timezone"             VARCHAR(80) NOT NULL DEFAULT 'Europe/Paris',
    "invitee_name"         VARCHAR(255),
    "invitee_email"        CITEXT,
    "invitee_phone"        VARCHAR(40),
    "source"               "calendly_event_source" NOT NULL DEFAULT 'embed_js',
    "raw_payload"          JSONB NOT NULL,
    "page_url"             VARCHAR(500),
    "utm_source"           VARCHAR(100),
    "utm_campaign"         VARCHAR(100),
    "utm_medium"           VARCHAR(100),
    "referrer"             VARCHAR(500),
    "linked_submission_id" UUID,
    "captured_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,
    "notes"                TEXT,
    CONSTRAINT "calendly_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "calendly_events_status_idx" ON "calendly_events" ("status");
CREATE INDEX IF NOT EXISTS "calendly_events_start_time_idx" ON "calendly_events" ("start_time");
CREATE INDEX IF NOT EXISTS "calendly_events_invitee_email_idx" ON "calendly_events" ("invitee_email");
CREATE INDEX IF NOT EXISTS "calendly_events_captured_at_idx" ON "calendly_events" ("captured_at");
CREATE INDEX IF NOT EXISTS "calendly_events_linked_submission_id_idx" ON "calendly_events" ("linked_submission_id");

DO $$ BEGIN
    ALTER TABLE "calendly_events"
        ADD CONSTRAINT "calendly_events_linked_submission_id_fkey"
        FOREIGN KEY ("linked_submission_id") REFERENCES "submissions"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
