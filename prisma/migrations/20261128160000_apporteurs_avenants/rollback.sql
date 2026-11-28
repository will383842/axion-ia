-- Rollback de 20261128160000_apporteurs_avenants.
-- Seulement sur décision du fondateur. Sauvegarder d'abord :
--   COPY "apporteur_avenants" TO '/chemin/sauvegarde-apporteur_avenants.csv' CSV HEADER;
-- Met la table de côté sans rien supprimer (les preuves d'acceptation y sont).
BEGIN;
ALTER TABLE IF EXISTS "apporteur_avenants" RENAME TO "apporteur_avenants_archive";
COMMIT;
