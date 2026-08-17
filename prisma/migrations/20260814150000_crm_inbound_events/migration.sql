-- Lot L5 (2026-08-14) — JOURNAL des événements ENTRANTS du CRM.
--
-- Le flux principal est site → CRM (outbox du lot L2). Les consentements font
-- exception : ils doivent converger dans les DEUX sens, sinon les deux systèmes
-- finissent par écrire des états opposés. Le CRM POSTe donc ses oppositions sur
-- `/api/internal/crm-webhook`, signé HMAC.
--
-- Ce que cette table garantit :
--   · `event_id` UNIQUE ⇒ idempotence stricte. Un émetteur qui retente après un
--     timeout ne réapplique rien et reçoit quand même 200.
--   · `payload` conserve le corps reçu ⇒ une opposition qu'on n'a pas su
--     rattacher à une ligne du site laisse une TRACE au lieu de disparaître.
--
-- 🔴 ANTI-BOUCLE : rien de ce qui est consigné ici ne repart vers le CRM. Le
-- handler n'appelle aucune fonction `sync*ToCrm` — vérifié par un test qui
-- espionne le module de synchro sortante.
--
-- MIGRATION PUREMENT ADDITIVE : une table neuve, aucune table existante
-- touchée, aucune colonne modifiée.

CREATE TABLE "crm_inbound_events" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    -- Identifiant de l'événement chez l'ÉMETTEUR (le CRM) : clé d'idempotence.
    "event_id"     VARCHAR(80)  NOT NULL,
    "event_type"   VARCHAR(40)  NOT NULL,
    -- sha256(email en minuscules), NON salé, calculé par le CRM. Ce n'est PAS
    -- le `person_key` du site (HMAC clé) : les deux ne se comparent jamais.
    "email_hash"   VARCHAR(64)  NOT NULL,
    "scope"        VARCHAR(16)  NOT NULL,
    "payload"      JSONB        NOT NULL,
    "processed_at" TIMESTAMP(3),
    -- `applied` | `no_match` | `ignored` — l'effet local réellement obtenu.
    "outcome"      VARCHAR(24),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_inbound_events_pkey" PRIMARY KEY ("id")
);

-- L'index qui PORTE l'idempotence : sans lui, deux livraisons simultanées du
-- même événement passeraient toutes les deux.
CREATE UNIQUE INDEX "crm_inbound_events_event_id_key" ON "crm_inbound_events"("event_id");
CREATE INDEX "crm_inbound_events_email_hash_idx" ON "crm_inbound_events"("email_hash");
CREATE INDEX "crm_inbound_events_created_at_idx" ON "crm_inbound_events"("created_at" DESC);
