-- Corbeille de validation des emails + règles d'automatisation.
--
-- Audit certification 2026-07-26. Décision Will : les emails COMMERCIAUX
-- (relance d'impayé, devis, facture) passent par une validation humaine avant
-- envoi ; la chaîne Qualiopi automatique (convocation, rappel J-7, satisfaction
-- J+1, suivi J+30, attestation) part seule — la retenir exposerait un stagiaire
-- à ne jamais recevoir sa convocation, et les indicateurs 4, 9, 11, 30 et 32 en
-- dépendent.
--
-- Le réglage est modifiable dans les deux sens, globalement ou par client.

CREATE TYPE "EmailOutboxStatus" AS ENUM ('a_valider', 'approuve', 'envoye', 'refuse');
CREATE TYPE "EmailAutomationScope" AS ENUM ('global', 'client');
CREATE TYPE "EmailAutomationMode" AS ENUM ('auto', 'validation');

CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL,
    "template" VARCHAR(60) NOT NULL,
    "recipient" CITEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "payload" JSONB NOT NULL,
    "sujet" VARCHAR(300) NOT NULL,
    "message_personnalise" TEXT,
    "statut" "EmailOutboxStatus" NOT NULL DEFAULT 'a_valider',
    "client_id" UUID,
    "entity_type" VARCHAR(80),
    "entity_id" VARCHAR(64),
    "attachments" JSONB,
    "approuve_at" TIMESTAMP(3),
    "approuve_by_id" UUID,
    "refuse_at" TIMESTAMP(3),
    "refuse_motif" TEXT,
    "envoye_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_outbox_statut_idx" ON "email_outbox"("statut");
CREATE INDEX "email_outbox_template_idx" ON "email_outbox"("template");
CREATE INDEX "email_outbox_client_id_idx" ON "email_outbox"("client_id");
CREATE INDEX "email_outbox_created_at_idx" ON "email_outbox"("created_at");

ALTER TABLE "email_outbox"
  ADD CONSTRAINT "email_outbox_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "email_automation_settings" (
    "id" UUID NOT NULL,
    "scope" "EmailAutomationScope" NOT NULL,
    "client_id" UUID,
    "template" VARCHAR(60),
    "mode" "EmailAutomationMode" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_automation_settings_pkey" PRIMARY KEY ("id")
);

-- Une seule règle par (portée, client, template). `NULLS NOT DISTINCT` est
-- indispensable : sans lui, deux règles globales « tous templates » (template
-- NULL) pourraient coexister et la résolution deviendrait non déterministe.
CREATE UNIQUE INDEX "email_automation_unique"
  ON "email_automation_settings"("scope", "client_id", "template") NULLS NOT DISTINCT;

CREATE INDEX "email_automation_settings_client_id_idx"
  ON "email_automation_settings"("client_id");

ALTER TABLE "email_automation_settings"
  ADD CONSTRAINT "email_automation_settings_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
