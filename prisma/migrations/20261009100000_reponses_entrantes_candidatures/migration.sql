-- Réponses reçues par e-mail des candidats emploi (lot L3, 2026-10-07) — ADDITIF uniquement.
--
-- Nouvelle table `job_application_inbound_replies` : les réponses qu'un candidat envoie à la
-- boîte Zoho Mail après un message parti de chez nous, relevées toutes les 15 minutes par le
-- worker (file `formation-crons`, passage `reponses-entrantes-candidatures`). Miroir de
-- `submission_inbound_replies` (apporteurs), qui n'est pas touchée. AUCUNE colonne ajoutée à
-- une table existante.
--
-- Fenêtre app/worker : le worker atterrit ~50 min AVANT que l'app ne joue cette migration.
-- Pendant ce temps le relevé lit une table absente : il s'abstient (P2021, curseur inchangé,
-- repris au passage suivant), et la fiche n'affiche simplement pas le bloc.
--
-- Aucune purge ne vise cette table (ordre de Will, 2026-10-07). Seule la suppression du
-- dossier (effacement manuel) l'emporte, par la cascade.
--
-- Réversible :
--   DROP TABLE "job_application_inbound_replies";

-- CreateTable
CREATE TABLE "job_application_inbound_replies" (
    "id" TEXT NOT NULL,
    "application_id" UUID NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "from_email_hash" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "excerpt" TEXT,
    "zoho_message_id" VARCHAR(64) NOT NULL,
    "zoho_folder_id" VARCHAR(64),
    "internet_message_id" VARCHAR(500),
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_application_inbound_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_application_inbound_replies_zoho_message_id_key" ON "job_application_inbound_replies"("zoho_message_id");

-- CreateIndex
CREATE INDEX "job_application_inbound_replies_application_id_received_at_idx" ON "job_application_inbound_replies"("application_id", "received_at");

-- CreateIndex
CREATE INDEX "job_application_inbound_replies_from_email_hash_idx" ON "job_application_inbound_replies"("from_email_hash");

-- AddForeignKey
ALTER TABLE "job_application_inbound_replies" ADD CONSTRAINT "job_application_inbound_replies_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
