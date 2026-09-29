-- INT-T02 (2026-09-26) — FILE DE SORTIE vers Axion Partners.
--
-- Cadrage : partners/ADR-0022 point 15 (dépôt axion-apporteurs), patron
-- `crm_sync_outbox`. Deux différences avec ce patron, voulues :
--   · la ligne est écrite DANS la transaction de l'écriture métier
--     (REQ-INT-001) : un retour arrière ne laisse rien, une validation laisse
--     exactement une ligne ;
--   · le corps transmis est conservé en TEXTE (`corps`), jamais en JSONB, qui
--     réordonne les clés : la relecture (REQ-INT-012) rend l'octet exact.
--
-- `sequence` reste NULL tant que le relais n'a pas pris la ligne ; il la pose
-- sous verrou consultatif, dans l'ordre d'envoi, dense et globale.
--
-- MIGRATION PUREMENT ADDITIVE : un type et une table neufs, aucune table
-- existante touchée. Tant que `PARTNERS_SYNC_ENABLED` n'est pas à "true",
-- aucun chemin de code n'y écrit : elle reste VIDE.

CREATE TYPE "PartnersSyncStatus" AS ENUM ('pending', 'sent', 'failed', 'gave_up');

CREATE TABLE "partners_sync_outbox" (
    "id"              UUID                 NOT NULL DEFAULT gen_random_uuid(),
    "event_id"        UUID                 NOT NULL,
    "event_type"      VARCHAR(64)          NOT NULL,
    "subject_ref"     VARCHAR(180)         NOT NULL,
    "sequence"        BIGINT,
    "corps"           TEXT                 NOT NULL,
    "status"          "PartnersSyncStatus" NOT NULL DEFAULT 'pending',
    "attempts"        INTEGER              NOT NULL DEFAULT 0,
    "last_error"      VARCHAR(500),
    "last_attempt_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "sent_at"         TIMESTAMP(3),
    "response_status" INTEGER,
    "created_at"      TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_sync_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partners_sync_outbox_event_id_key" ON "partners_sync_outbox"("event_id");
CREATE UNIQUE INDEX "partners_sync_outbox_sequence_key" ON "partners_sync_outbox"("sequence");
-- Le balayage : « les lignes dues ».
CREATE INDEX "partners_sync_outbox_status_next_attempt_at_idx" ON "partners_sync_outbox"("status", "next_attempt_at");
CREATE INDEX "partners_sync_outbox_subject_ref_idx" ON "partners_sync_outbox"("subject_ref");
