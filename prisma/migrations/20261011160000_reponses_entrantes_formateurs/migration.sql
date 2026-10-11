-- CAMP-4 (chantier formateurs indépendants) — `reponses_entrantes_formateurs`.
--
-- Les réponses d'un formateur indépendant (ou d'un candidat formateur) : relevées dans
-- la boîte Zoho par le relevé des candidatures existant, ou déclarées en console
-- (« J'ai répondu ailleurs »). Ni corps, ni objet, ni adresse : l'empreinte et l'heure.
--
-- Ajout seul : une table neuve, ses index et ses clés étrangères. Aucune donnée
-- existante touchée, aucun DROP.
CREATE TABLE IF NOT EXISTS "reponses_entrantes_formateurs" (
    "id" UUID NOT NULL,
    "trainer_id" UUID,
    "candidature_id" UUID,
    "source" VARCHAR(20) NOT NULL,
    "recu_le" TIMESTAMP(3) NOT NULL,
    "from_email_hash" VARCHAR(64),
    "zoho_message_id" VARCHAR(64),
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "auteur_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reponses_entrantes_formateurs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reponses_entrantes_formateurs_zoho_message_id_key"
    ON "reponses_entrantes_formateurs"("zoho_message_id");
CREATE INDEX IF NOT EXISTS "reponses_entrantes_formateurs_trainer_id_recu_le_idx"
    ON "reponses_entrantes_formateurs"("trainer_id", "recu_le");
CREATE INDEX IF NOT EXISTS "reponses_entrantes_formateurs_candidature_id_recu_le_idx"
    ON "reponses_entrantes_formateurs"("candidature_id", "recu_le");

DO $$ BEGIN
  ALTER TABLE "reponses_entrantes_formateurs"
    ADD CONSTRAINT "reponses_entrantes_formateurs_trainer_id_fkey"
    FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "reponses_entrantes_formateurs"
    ADD CONSTRAINT "reponses_entrantes_formateurs_candidature_id_fkey"
    FOREIGN KEY ("candidature_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
