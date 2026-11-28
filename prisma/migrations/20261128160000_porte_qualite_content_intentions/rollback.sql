-- Rollback de 20261128160000_porte_qualite_content_intentions — à lancer à la main, jamais par le déploiement.
-- Seulement sur décision du fondateur, après sauvegarde si la table contient des lignes :
--   \copy "content_intentions" TO 'content_intentions_20261128.csv' CSV HEADER
-- Rien n'est supprimé : la table est mise de côté sous un autre nom (ses index suivent).
BEGIN;
ALTER TABLE IF EXISTS "content_intentions" RENAME TO "content_intentions_retire_20261128";
COMMIT;
-- Attention : ne pas relancer `migrate deploy` tant que le dossier de la migration reste dans le dépôt.
