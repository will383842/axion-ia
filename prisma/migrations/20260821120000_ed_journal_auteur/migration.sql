-- Console éditoriale — le journal enregistre son auteur.
--
-- Défaut trouvé par les passes 2 et 5 du protocole, séparément : toutes les
-- entrées de `ed_journal` portaient `membre_id = NULL`, parce que cette clé
-- étrangère vise `ed_membres` et qu'une console « à un seul utilisateur au
-- départ » n'a aucun membre déclaré. Le critère 3 du lot 4 — « toute mutation
-- au journal AVEC SON AUTEUR » — n'était donc jamais tenu.
--
-- Pas de clé étrangère vers `admin_users` : un journal doit survivre à la
-- suppression du compte qu'il incrimine, sinon il s'efface au moment précis
-- où il servirait.
--
-- 100 % additif. Les entrées existantes gardent NULL, ce qui est la vérité :
-- personne ne sait qui les a écrites.

-- AlterTable
ALTER TABLE "ed_journal" ADD COLUMN     "auteur_nom" VARCHAR(160),
ADD COLUMN     "auteur_user_id" TEXT;
