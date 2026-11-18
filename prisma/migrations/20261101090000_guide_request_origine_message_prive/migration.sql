-- PV-1 (2026-11-01) — parcours « mot en commentaire → message privé → e-mail → guide ».
--
-- MIGRATION STRICTEMENT ADDITIVE : une valeur d'énumération, rien d'autre.
-- Aucun DROP, aucun renommage, aucune colonne. Mise en ligne AVANT le code qui
-- écrit la valeur (PR suivante du même lot) : le worker atterrit ~50 min avant
-- l'application, et l'application est celle qui joue cette migration.
--
-- PG >= 12 : ADD VALUE autorisé en transaction tant que la valeur n'est pas
-- utilisée dans la même transaction (elle ne l'est pas).
ALTER TYPE "GuideRequestOrigine" ADD VALUE IF NOT EXISTS 'message_prive';
