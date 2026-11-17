-- Seulement sur décision du fondateur, après sauvegarde, dans une transaction,
-- et APRÈS avoir éteint EMAIL_MANUEL_ACTIF puis retiré le code lecteur (fenêtre app/worker).
-- Rien n'est supprimé : les tables sont mises de côté avec leurs index et leurs données.
BEGIN;
CREATE SCHEMA IF NOT EXISTS "retrait";
ALTER TABLE "emails_manuels_pieces_jointes" SET SCHEMA "retrait";
ALTER TABLE "emails_manuels" SET SCHEMA "retrait";
COMMIT;
-- Puis : prisma migrate resolve --rolled-back 20261118100000_emails_manuels

-- Repli si le rôle de la base n'a pas le droit CREATE sur la base : renommer chaque table
-- ET chaque index (suffixes _pkey, _key, _idx) avec le suffixe _retire_20261118, par exemple :
--   ALTER TABLE "emails_manuels" RENAME TO "emails_manuels_retire_20261118";
--   ALTER INDEX "emails_manuels_pkey" RENAME TO "emails_manuels_pkey_retire_20261118";
-- (idem pour emails_manuels_pieces_jointes et chacun de leurs index). Aucun DROP.
