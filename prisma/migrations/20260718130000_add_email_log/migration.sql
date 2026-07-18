-- Traçabilité durable des envois d'emails (queue `emails` / email-worker) —
-- indicateur RNQ (preuve d'envoi auditable) : la trace ne vivait qu'en Redis
-- (BullMQ, purgé). Une ligne par tentative (chaque retry `failed` est conservé).
-- Ajout du verrou d'idempotence `notified_at` sur alertes_systeme (anti-spam).
-- Migration ADDITIVE : aucun DROP, aucune colonne NOT NULL sans default.

-- CreateEnum
CREATE TYPE "email_log_status" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "email_logs" (
    "id" UUID NOT NULL,
    "template" VARCHAR(60) NOT NULL,
    "recipient" CITEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "entity_type" VARCHAR(80),
    "entity_id" VARCHAR(64),
    "status" "email_log_status" NOT NULL DEFAULT 'pending',
    "job_id" VARCHAR(200),
    "provider_message_id" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_template_idx" ON "email_logs"("template");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_entity_type_entity_id_idx" ON "email_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "email_logs_recipient_idx" ON "email_logs"("recipient");

-- CreateIndex
CREATE INDEX "email_logs_created_at_idx" ON "email_logs"("created_at");

-- AlterTable
ALTER TABLE "alertes_systeme" ADD COLUMN "notified_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "alertes_systeme_niveau_resolue_notified_at_idx" ON "alertes_systeme"("niveau", "resolue", "notified_at");

-- Backfill : marque les alertes non résolues préexistantes comme déjà notifiées
-- pour éviter une rafale d'emails au premier passage du cron après déploiement.
UPDATE "alertes_systeme" SET "notified_at" = now() WHERE resolue = false;
