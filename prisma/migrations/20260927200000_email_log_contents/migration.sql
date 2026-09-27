-- Copie des e-mails envoyés (2026-09-27) — ADDITIF uniquement.
--
-- Nouvelle table `email_log_contents`, 1-1 avec `email_logs` (clé primaire =
-- clé étrangère, suppression en cascade). AUCUNE colonne ajoutée à
-- `email_logs` : le journal reste léger pour la liste et la surveillance.
--
-- Fenêtre app/worker : le worker peut atterrir avant que l'app ne joue cette
-- migration. Il écrit la copie en best-effort (`enregistrerCopieEnvoi`) : tant
-- que la table n'existe pas, l'écriture échoue, est journalisée, et l'envoi
-- n'est PAS affecté.
--
-- Réversible :
--   DROP TABLE "email_log_contents";

CREATE TABLE "email_log_contents" (
    "email_log_id" UUID NOT NULL,
    "subject" VARCHAR(998) NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachment_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secrets_masques" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_contents_pkey" PRIMARY KEY ("email_log_id")
);

CREATE INDEX "email_log_contents_created_at_idx" ON "email_log_contents"("created_at");

ALTER TABLE "email_log_contents" ADD CONSTRAINT "email_log_contents_email_log_id_fkey" FOREIGN KEY ("email_log_id") REFERENCES "email_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
