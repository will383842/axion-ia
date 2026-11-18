-- Brouillon du questionnaire de pré-audit (demande Will 2026-10-24 : « zéro perte de réponses
-- pendant le remplissage »). ADDITIVE : une table neuve, aucune existante touchée, aucune
-- énumération, aucun job BullMQ (le worker ne lit pas cette table). RÉ-EXÉCUTABLE : tout est gardé.
-- Retour arrière (JAMAIS exécuté par défaut) :
--   DROP TABLE "questionnaires_avant_audit_brouillons";
CREATE TABLE IF NOT EXISTS "questionnaires_avant_audit_brouillons" (
    "id" UUID NOT NULL,
    "questionnaire_id" UUID NOT NULL,
    "mode" VARCHAR(8) NOT NULL,
    "membre" VARCHAR(60) NOT NULL DEFAULT '',
    "horodatage" TIMESTAMP(3) NOT NULL,
    "maj_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "donnees" TEXT NOT NULL,
    CONSTRAINT "questionnaires_avant_audit_brouillons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "questionnaires_avant_audit_brouillons_personne_key"
    ON "questionnaires_avant_audit_brouillons"("questionnaire_id", "mode", "membre");
CREATE INDEX IF NOT EXISTS "questionnaires_avant_audit_brouillons_maj_le_idx"
    ON "questionnaires_avant_audit_brouillons"("maj_le");
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questionnaires_avant_audit_brouillons_questionnaire_id_fkey') THEN
        ALTER TABLE "questionnaires_avant_audit_brouillons"
            ADD CONSTRAINT "questionnaires_avant_audit_brouillons_questionnaire_id_fkey"
            FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires_avant_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
