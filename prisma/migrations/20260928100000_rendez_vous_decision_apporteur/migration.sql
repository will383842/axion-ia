-- Issue de l'échange avec un candidat apporteur (2026-09-28) — ADDITIF uniquement.
--
-- Un type énuméré NEUF et deux colonnes NULLABLES sur `rendez_vous_suivis`. Aucune
-- valeur retirée, aucune colonne existante modifiée.
--
-- Fenêtre app/worker : le worker atterrit ~50 min AVANT que l'app ne joue cette
-- migration. Il ne lit ni n'écrit `rendez_vous_suivis` (table dédiée justement pour
-- cette raison, cf. le commentaire du modèle) : il ne voit donc pas la différence.
--
-- Réversible :
--   ALTER TABLE "rendez_vous_suivis" DROP COLUMN "decision", DROP COLUMN "note_sur_20";
--   DROP TYPE "rendez_vous_decision_apporteur";

-- CreateEnum
CREATE TYPE "rendez_vous_decision_apporteur" AS ENUM ('retenu', 'a_revoir', 'non_retenu');

-- AlterTable
ALTER TABLE "rendez_vous_suivis" ADD COLUMN "decision" "rendez_vous_decision_apporteur",
ADD COLUMN "note_sur_20" SMALLINT;
