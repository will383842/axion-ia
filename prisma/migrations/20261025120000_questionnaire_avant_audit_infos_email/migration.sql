-- Questionnaire de pré-audit (2026-10-25) : case SÉPARÉE « recevoir des informations par e-mail ».
-- ADDITIVE ET RÉ-EXÉCUTABLE : une colonne NULLABLE neuve (NULL = la charge ne portait pas la case).
-- Aucune donnée modifiée, aucune énumération, aucun job BullMQ (le worker ne lit pas cette table).
-- Elle n'abonne personne et ne déclenche aucun envoi.
ALTER TABLE "questionnaires_avant_audit_envois"
    ADD COLUMN IF NOT EXISTS "infos_email" BOOLEAN;
