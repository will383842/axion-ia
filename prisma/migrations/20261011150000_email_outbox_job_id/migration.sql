-- CAMP-2 (chantier formateurs indépendants) — `EmailOutbox.jobId`.
--
-- La clé d'idempotence d'un envoi GARÉ en corbeille de validation. Sans elle, le
-- moteur de campagnes ne voit que le journal (`email_logs`) : une relance garée,
-- donc absente du journal, serait garée une seconde fois au passage suivant.
--
-- Ajout seul : colonne nullable, index simple. Aucune donnée existante touchée.
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "job_id" VARCHAR(200);

CREATE INDEX IF NOT EXISTS "email_outbox_job_id_idx" ON "email_outbox"("job_id");
