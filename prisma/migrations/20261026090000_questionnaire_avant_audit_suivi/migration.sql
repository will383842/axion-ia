-- Questionnaire avant audit (2026-10-26) : suivi après le clic « Envoyer » de Will (relances
-- demandées, date de l'audit, J0) et journal des courriers (relances, confirmations, Telegram).
-- ADDITIVE : deux tables neuves, aucune table existante touchée, aucune énumération Postgres
-- (VARCHAR + unions TypeScript), aucune forme de job BullMQ changée. RÉ-EXÉCUTABLE : tout est
-- gardé (IF NOT EXISTS, contraintes dans un bloc DO). Le worker peut tourner AVANT cette
-- migration (deux conteneurs) : son balayage s'arrête en silence sur P2021/P2022.
-- Clés étrangères en SET NULL : un redépôt (DELETE du questionnaire) laisse le journal intact.
-- Retour arrière (JAMAIS exécuté par défaut) :
--   DROP TABLE "questionnaires_avant_audit_courriers";
--   DROP TABLE "questionnaires_avant_audit_suivis";
CREATE TABLE IF NOT EXISTS "questionnaires_avant_audit_suivis" (
    "id" UUID NOT NULL,
    "questionnaire_id" UUID,
    "relances_demandees" BOOLEAN NOT NULL DEFAULT false,
    "date_audit" TIMESTAMP(3),
    "lieu_audit" VARCHAR(80),
    "premier_envoi_le" TIMESTAMP(3),
    "relances_arretees_le" TIMESTAMP(3),
    "relances_arret_motif" VARCHAR(40),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "questionnaires_avant_audit_suivis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "questionnaires_avant_audit_suivis_questionnaire_id_key"
    ON "questionnaires_avant_audit_suivis"("questionnaire_id");

CREATE TABLE IF NOT EXISTS "questionnaires_avant_audit_courriers" (
    "id" UUID NOT NULL,
    "cle" VARCHAR(120) NOT NULL,
    "questionnaire_id" UUID,
    "envoi_id" UUID,
    "nature" VARCHAR(28) NOT NULL,
    "canal" VARCHAR(10) NOT NULL,
    "statut" VARCHAR(12) NOT NULL,
    "prevu_le" TIMESTAMP(3) NOT NULL,
    "pris_le" TIMESTAMP(3),
    "fait_le" TIMESTAMP(3),
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "motif" VARCHAR(200),
    "destinataire_hash" VARCHAR(64),
    "essai_de" VARCHAR(28),
    "job_id" VARCHAR(200),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "questionnaires_avant_audit_courriers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "questionnaires_avant_audit_courriers_cle_key"
    ON "questionnaires_avant_audit_courriers"("cle");
CREATE INDEX IF NOT EXISTS "questionnaires_avant_audit_courriers_statut_prevu_le_idx"
    ON "questionnaires_avant_audit_courriers"("statut", "prevu_le");
CREATE INDEX IF NOT EXISTS "questionnaires_avant_audit_courriers_questionnaire_id_idx"
    ON "questionnaires_avant_audit_courriers"("questionnaire_id");
CREATE INDEX IF NOT EXISTS "questionnaires_avant_audit_courriers_envoi_id_idx"
    ON "questionnaires_avant_audit_courriers"("envoi_id");
CREATE INDEX IF NOT EXISTS "questionnaires_avant_audit_courriers_destinataire_hash_idx"
    ON "questionnaires_avant_audit_courriers"("destinataire_hash");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questionnaires_avant_audit_suivis_questionnaire_id_fkey') THEN
        ALTER TABLE "questionnaires_avant_audit_suivis"
            ADD CONSTRAINT "questionnaires_avant_audit_suivis_questionnaire_id_fkey"
            FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires_avant_audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questionnaires_avant_audit_courriers_questionnaire_id_fkey') THEN
        ALTER TABLE "questionnaires_avant_audit_courriers"
            ADD CONSTRAINT "questionnaires_avant_audit_courriers_questionnaire_id_fkey"
            FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires_avant_audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questionnaires_avant_audit_courriers_envoi_id_fkey') THEN
        ALTER TABLE "questionnaires_avant_audit_courriers"
            ADD CONSTRAINT "questionnaires_avant_audit_courriers_envoi_id_fkey"
            FOREIGN KEY ("envoi_id") REFERENCES "questionnaires_avant_audit_envois"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
