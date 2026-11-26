-- Seulement sur décision du fondateur, après sauvegarde, dans une transaction, et APRÈS avoir retiré le
-- code lecteur (fenêtre app/worker : les lectures se replient sur la fiche quand la table manque).
-- Rien n'est supprimé : les tables sont mises de côté avec leurs index et leurs données.
BEGIN;
CREATE SCHEMA IF NOT EXISTS "retrait";
ALTER TABLE "apporteur_regime_tva_changements" SET SCHEMA "retrait";
ALTER TABLE "pieces_autofacture_apporteur" SET SCHEMA "retrait";
COMMIT;
-- Attention : ne pas relancer `migrate deploy` tant que le dossier de la migration reste dans le dépôt.
-- Repli si le rôle n'a pas le droit CREATE : renommer chaque table ET chaque index avec le suffixe
-- _retire_20261126. Aucun DROP.
