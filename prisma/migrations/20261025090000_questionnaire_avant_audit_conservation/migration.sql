-- Questionnaire de pré-audit, audit des données (2026-10-24). ADDITIVE ET RÉ-EXÉCUTABLE :
-- deux colonnes NULLABLES neuves sur les réponses, un index, et la clé vers la rencontre RELÂCHÉE
-- (NOT NULL retiré, ON DELETE CASCADE → SET NULL) : la suppression d'une rencontre (fin de
-- conservation) n'efface plus en cascade les réponses des salariés. Aucune colonne retirée, aucune
-- donnée modifiée, aucune énumération, aucun job BullMQ (le worker ne lit pas ces tables).
-- Retour arrière (JAMAIS exécuté par défaut) : remettre la contrainte en CASCADE.
ALTER TABLE "questionnaires_avant_audit_envois"
    ADD COLUMN IF NOT EXISTS "envoye_le_navigateur" VARCHAR(40);
ALTER TABLE "questionnaires_avant_audit_envois"
    ADD COLUMN IF NOT EXISTS "ecarte_le" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "questionnaires_avant_audit_envois_idempotence_idx"
    ON "questionnaires_avant_audit_envois"("questionnaire_id", "mode", "envoye_le_navigateur");

ALTER TABLE "questionnaires_avant_audit" ALTER COLUMN "rencontre_id" DROP NOT NULL;
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'questionnaires_avant_audit_rencontre_id_fkey' AND confdeltype = 'c'
    ) THEN
        ALTER TABLE "questionnaires_avant_audit"
            DROP CONSTRAINT "questionnaires_avant_audit_rencontre_id_fkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questionnaires_avant_audit_rencontre_id_fkey') THEN
        ALTER TABLE "questionnaires_avant_audit"
            ADD CONSTRAINT "questionnaires_avant_audit_rencontre_id_fkey"
            FOREIGN KEY ("rencontre_id") REFERENCES "rencontres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
