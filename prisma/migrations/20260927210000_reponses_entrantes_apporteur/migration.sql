-- Réponses entrantes des candidats apporteurs (2026-09-27) — ADDITIF uniquement.
--
-- Nouvelle table `submission_inbound_replies` : les réponses qu'une personne invitée à
-- l'échange apporteur envoie à la boîte Zoho Mail, relevées toutes les 15 minutes par le
-- worker (file `apporteur-crons`). AUCUNE colonne ajoutée à une table existante.
--
-- Fenêtre app/worker : le worker atterrit ~50 min AVANT que l'app ne joue cette migration.
-- Pendant ce temps il lit et écrit une table absente : le relevé s'abstient (P2021, curseur
-- inchangé, repris au passage suivant) et la lecture des rappels la tient pour vide — ce qui
-- est vrai, puisque rien n'a encore pu y être écrit.
--
-- Réversible :
--   DROP TABLE "submission_inbound_replies";

-- CreateTable
CREATE TABLE "submission_inbound_replies" (
    "id" TEXT NOT NULL,
    "submission_id" UUID NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "from_email_hash" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "excerpt" TEXT,
    "zoho_message_id" VARCHAR(64) NOT NULL,
    "zoho_folder_id" VARCHAR(64),
    "internet_message_id" VARCHAR(500),
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_inbound_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_inbound_replies_zoho_message_id_key" ON "submission_inbound_replies"("zoho_message_id");

-- CreateIndex
CREATE INDEX "submission_inbound_replies_submission_id_received_at_idx" ON "submission_inbound_replies"("submission_id", "received_at");

-- CreateIndex
CREATE INDEX "submission_inbound_replies_from_email_hash_idx" ON "submission_inbound_replies"("from_email_hash");

-- AddForeignKey
ALTER TABLE "submission_inbound_replies" ADD CONSTRAINT "submission_inbound_replies_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
