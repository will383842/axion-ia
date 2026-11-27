-- Réseau d'apporteurs — messages reçus d'un apporteur APRÈS l'invitation : e-mails relevés dans la
-- boîte Zoho (expéditeur = adresse d'une fiche apporteur) et demandes d'aide de l'espace apporteur.
-- Une table nouvelle, sans clé étrangère, sans énumération nouvelle (fenêtre app/worker : le worker
-- peut tourner avant l'app, il tolère l'absence de la table). Ajout seul, rejouable (IF NOT EXISTS) :
-- aucun UPDATE, DELETE, DROP ni ALTER sur une table existante.

CREATE TABLE IF NOT EXISTS "apporteur_messages_recus" (
    "id" UUID NOT NULL,
    "apporteur_id" UUID NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "from_email_hash" VARCHAR(64),
    "subject" VARCHAR(500) NOT NULL,
    "excerpt" TEXT,
    "zoho_message_id" VARCHAR(64),
    "zoho_folder_id" VARCHAR(64),
    "internet_message_id" VARCHAR(500),
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apporteur_messages_recus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "apporteur_messages_recus_zoho_message_id_key" ON "apporteur_messages_recus"("zoho_message_id");
CREATE INDEX IF NOT EXISTS "apporteur_messages_recus_apporteur_id_received_at_idx" ON "apporteur_messages_recus"("apporteur_id", "received_at");
CREATE INDEX IF NOT EXISTS "apporteur_messages_recus_from_email_hash_idx" ON "apporteur_messages_recus"("from_email_hash");
