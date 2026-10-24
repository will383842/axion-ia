-- Questionnaire de pré-audit (demande Will 2026-10-24). ADDITIVE : deux tables neuves, aucune
-- existante touchée, aucune énumération, aucun job BullMQ. Le code est derrière
-- QUESTIONNAIRE_AVANT_AUDIT_ENABLED (absent = éteint).
-- Retour arrière (JAMAIS exécuté par défaut) :
--   DROP TABLE "questionnaires_avant_audit_envois"; DROP TABLE "questionnaires_avant_audit";
CREATE TABLE IF NOT EXISTS "questionnaires_avant_audit" (
    "id" UUID NOT NULL,
    "rencontre_id" UUID NOT NULL,
    "html" TEXT NOT NULL,
    "ref" VARCHAR(40) NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoye_le" TIMESTAMP(3),
    "lu_le" TIMESTAMP(3),
    "lu_par_id" UUID,
    CONSTRAINT "questionnaires_avant_audit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "questionnaires_avant_audit_rencontre_id_key"
    ON "questionnaires_avant_audit"("rencontre_id");
ALTER TABLE "questionnaires_avant_audit"
    ADD CONSTRAINT "questionnaires_avant_audit_rencontre_id_fkey"
    FOREIGN KEY ("rencontre_id") REFERENCES "rencontres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "questionnaires_avant_audit_envois" (
    "id" UUID NOT NULL,
    "questionnaire_id" UUID NOT NULL,
    "mode" VARCHAR(8) NOT NULL,
    "membre" VARCHAR(60),
    "recu_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "donnees" TEXT NOT NULL,
    CONSTRAINT "questionnaires_avant_audit_envois_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "questionnaires_avant_audit_envois_questionnaire_id_idx"
    ON "questionnaires_avant_audit_envois"("questionnaire_id");
ALTER TABLE "questionnaires_avant_audit_envois"
    ADD CONSTRAINT "questionnaires_avant_audit_envois_questionnaire_id_fkey"
    FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires_avant_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
