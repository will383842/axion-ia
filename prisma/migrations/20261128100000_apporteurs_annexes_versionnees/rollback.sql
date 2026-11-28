-- Rollback de 20261128100000_apporteurs_annexes_versionnees.
-- Seulement sur décision du fondateur : ces tables sont la preuve de ce qui a été remis aux apporteurs.
-- Sauvegarder d'abord (COPY ... TO) ; ne rien supprimer sans sauvegarde :
--   COPY "documents_annexes_versions" TO '/chemin/sauvegarde/documents_annexes_versions.csv' CSV HEADER;
--   COPY "apporteur_documents_remis" TO '/chemin/sauvegarde/apporteur_documents_remis.csv' CSV HEADER;
-- Les tables sont mises de côté (RENAME), jamais supprimées. Les déclencheurs sont retirés d'abord.
DROP TRIGGER "documents_annexes_versions_no_delete" ON "documents_annexes_versions";
DROP TRIGGER "documents_annexes_versions_no_truncate" ON "documents_annexes_versions";
DROP TRIGGER "documents_annexes_versions_garde" ON "documents_annexes_versions";
DROP TRIGGER "apporteur_documents_remis_no_delete" ON "apporteur_documents_remis";
DROP TRIGGER "apporteur_documents_remis_no_truncate" ON "apporteur_documents_remis";
DROP TRIGGER "apporteur_documents_remis_garde" ON "apporteur_documents_remis";
ALTER TABLE "documents_annexes_versions" RENAME TO "documents_annexes_versions_retire_20261128";
ALTER TABLE "apporteur_documents_remis" RENAME TO "apporteur_documents_remis_retire_20261128";
-- Les fonctions des déclencheurs : retirées pour qu'une réapplication de la migration ne bute pas sur CREATE FUNCTION.
DROP FUNCTION "documents_annexes_versions_refuse_delete"();
DROP FUNCTION "documents_annexes_versions_garde_update"();
DROP FUNCTION "apporteur_documents_remis_refuse_delete"();
DROP FUNCTION "apporteur_documents_remis_garde_update"();
