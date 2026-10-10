-- L12 (paquet 4a, chantier « candidatures unifiées ») — états des vidéos et des liens des
-- candidats en LISTES FERMÉES, phase « expand » seulement.
--
-- Avant : `job_application_videos.statut` et `job_application_links.etat` sont des VARCHAR ;
-- une faute de frappe s'y écrivait sans alerte. Ici : deux types énumérés, deux colonnes
-- NULLABLES écrites EN MÊME TEMPS que l'ancienne colonne texte, et un rattrapage du stock.
--
-- ADDITIVE : aucune colonne retirée, aucune ligne supprimée. L'ancienne colonne texte reste
-- écrite et LUE ; la phase « contract » (lecture de la colonne enum, retrait du texte) viendra
-- dans une PR à part, une fois le stock vérifié.
--
-- Fenêtre app/worker (AGENTS.md) : les vidéos sont écrites par l'APP, qui migre avant de servir.
-- Les liens sont écrits par le WORKER (passage du lundi), qui peut tourner le nouveau code
-- AVANT cette migration : `liens-surveilles.ts` retombe alors sur l'écriture texte seule
-- (erreur P2022, colonne absente), et le rattrapage ci-dessous comble ces lignes ensuite —
-- il ne touche que les lignes encore NULL, donc il se rejoue sans risque.

-- CreateEnum
CREATE TYPE "EtatVideoCandidat" AS ENUM ('envoi', 'analyse', 'disponible', 'rejetee');

-- CreateEnum
CREATE TYPE "EtatLienCandidat" AS ENUM ('vivant', 'mort', 'inverifiable');

-- AlterTable
ALTER TABLE "job_application_videos" ADD COLUMN "etat_ferme" "EtatVideoCandidat";

-- AlterTable
ALTER TABLE "job_application_links" ADD COLUMN "etat_ferme" "EtatLienCandidat";

-- Rattrapage idempotent, BORNÉ à la liste : une valeur texte inconnue (faute de frappe
-- historique) ne fait pas échouer la migration, elle reste NULL — et se repère par
-- `WHERE etat_ferme IS NULL`.
UPDATE "job_application_videos" SET "etat_ferme" = "statut"::"EtatVideoCandidat" WHERE "etat_ferme" IS NULL AND "statut" IN ('envoi', 'analyse', 'disponible', 'rejetee');
UPDATE "job_application_links" SET "etat_ferme" = "etat"::"EtatLienCandidat" WHERE "etat_ferme" IS NULL AND "etat" IN ('vivant', 'mort', 'inverifiable');
