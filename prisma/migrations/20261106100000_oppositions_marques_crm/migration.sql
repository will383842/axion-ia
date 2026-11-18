-- Oppositions : deux marques pour le réessai de l'avertissement du CRM (PR #1806).
-- ADDITIVE : deux colonnes nullables, aucune valeur par défaut, aucun UPDATE / DELETE / DROP.
--   crm_en_attente_depuis : posée à la création, remise à NULL dès que le CRM est prévenu.
--   crm_interdit_le       : posée par l'effacement ; une fois posée, le CRM n'est plus jamais rappelé.
-- Retour arrière : rollback.sql (deux DROP COLUMN IF EXISTS).
ALTER TABLE "email_oppositions" ADD COLUMN "crm_en_attente_depuis" TIMESTAMPTZ NULL;
ALTER TABLE "email_oppositions" ADD COLUMN "crm_interdit_le" TIMESTAMPTZ NULL;
