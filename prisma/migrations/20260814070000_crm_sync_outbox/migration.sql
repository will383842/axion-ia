-- Lot L2 (2026-08-14) — OUTBOX de synchronisation vers Axion CRM Pro.
--
-- Motif « transactional outbox » appliqué au parcours de capture du site :
-- l'événement à transmettre est POSÉ EN BASE avant toute tentative réseau.
-- Conséquence : un CRM injoignable ne fait perdre aucun lead et ne ralentit
-- aucun formulaire — il fait seulement grossir la file, ce qui se voit.
--
-- MIGRATION PUREMENT ADDITIVE : une table neuve, aucune table existante
-- touchée. Tant que `CRM_SYNC_ENABLED` n'est pas à "true", elle reste VIDE
-- (aucun chemin de code n'y écrit) — l'inertie est donc vérifiable en base.
--
-- ⚠️ Ne pas confondre avec `email_outbox` (corbeille de validation des emails
-- sortants, Sprint 15) : rien à voir, deux mécanismes distincts.

CREATE TYPE "CrmSyncStatus" AS ENUM ('pending', 'sent', 'failed', 'gave_up');

CREATE TABLE "crm_sync_outbox" (
    "id"              UUID           NOT NULL DEFAULT gen_random_uuid(),
    -- Clé d'idempotence de l'ÉVÉNEMENT, transmise telle quelle au CRM qui la
    -- stocke en `activities.external_ref` : rejouer cette ligne ne peut donc
    -- jamais créer de doublon de l'autre côté.
    "event_id"        UUID           NOT NULL,
    "event_type"      VARCHAR(64)    NOT NULL,
    -- Référence de l'enregistrement source (`site:submission:<uuid>`) : permet
    -- la réconciliation « qu'ai-je oublié d'émettre ? ».
    "subject_ref"     VARCHAR(180)   NOT NULL,
    "universe"        VARCHAR(16)    NOT NULL,
    "payload"         JSONB          NOT NULL,
    "status"          "CrmSyncStatus" NOT NULL DEFAULT 'pending',
    "attempts"        INTEGER        NOT NULL DEFAULT 0,
    "last_error"      VARCHAR(500),
    "last_attempt_at" TIMESTAMP(3),
    -- Backoff exponentiel : le balayage ne reprend pas une ligne avant cette date.
    "next_attempt_at" TIMESTAMP(3),
    "sent_at"         TIMESTAMP(3),
    "response_status" INTEGER,
    "crm_result"      VARCHAR(32),
    "created_at"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "crm_sync_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_sync_outbox_event_id_key" ON "crm_sync_outbox"("event_id");
-- L'index qui porte le balayage : « les lignes dues, les plus vieilles d'abord ».
CREATE INDEX "crm_sync_outbox_status_next_attempt_at_idx" ON "crm_sync_outbox"("status", "next_attempt_at");
CREATE INDEX "crm_sync_outbox_subject_ref_idx" ON "crm_sync_outbox"("subject_ref");
CREATE INDEX "crm_sync_outbox_created_at_idx" ON "crm_sync_outbox"("created_at" DESC);
