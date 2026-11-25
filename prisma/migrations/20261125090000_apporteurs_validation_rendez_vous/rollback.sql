-- Seulement sur décision du fondateur, après sauvegarde, dans une transaction,
-- et APRÈS avoir éteint APPORTEURS_VALIDATION_RDV puis retiré le code lecteur (fenêtre app/worker).
-- Rien n'est supprimé : les tables sont mises de côté avec leurs index et leurs données.
BEGIN;
CREATE SCHEMA IF NOT EXISTS "retrait";
ALTER TABLE "propositions_rendez_vous_presentation" SET SCHEMA "retrait";
ALTER TABLE "presentation_reservation" SET SCHEMA "retrait";
COMMIT;
-- Les index (dont les deux uniques partiels) suivent leur table dans le schéma « retrait ».
-- Attention : `prisma migrate resolve --rolled-back` n'accepte qu'une migration en échec ; sur une
-- migration appliquée avec succès il refuse. L'état laissé par le bloc ci-dessus suffit : ne pas
-- relancer `migrate deploy` tant que le dossier de la migration reste dans le dépôt.

-- Repli si le rôle de la base n'a pas le droit CREATE sur la base : renommer chaque table
-- ET chaque index (suffixes _pkey, _key, _idx) avec le suffixe _retire_20261125, par exemple :
--   ALTER TABLE "presentation_reservation" RENAME TO "presentation_reservation_retire_20261125";
--   ALTER INDEX "presentation_reservation_pkey" RENAME TO "presentation_reservation_pkey_retire_20261125";
-- (idem pour propositions_rendez_vous_presentation et chacun de leurs index). Aucun DROP.
