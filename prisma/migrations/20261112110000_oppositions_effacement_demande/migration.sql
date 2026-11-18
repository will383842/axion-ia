-- Oppositions : marque « effacement demandé » (décision de Williams du 11/11/2026).
-- Une demande d'effacement RGPD ne supprime plus rien : la personne est MISE À L'ÉCART.
-- ADDITIVE : une colonne nullable, aucune valeur par défaut, aucun UPDATE / DELETE / DROP.
--   effacement_demande_le : posée par la demande d'effacement ; plus aucun envoi vers l'adresse.
-- Retour arrière : rollback.sql (un DROP COLUMN IF EXISTS).
ALTER TABLE "email_oppositions" ADD COLUMN "effacement_demande_le" TIMESTAMPTZ NULL;
