-- Rollback de 20261127090000_apporteurs_challenges.
-- Seulement sur décision du fondateur, après sauvegarde ; rien n'est supprimé : la table est
-- mise de côté sous un autre nom (éteindre d'abord APPORTEUR_CHALLENGES_CONSOLE_ENABLED et
-- APPORTEUR_CHALLENGES_ESPACE_ENABLED).
BEGIN;
ALTER TABLE IF EXISTS "challenges_apporteur" RENAME TO "challenges_apporteur_archive";
COMMIT;
