-- T0 Formation Engine + Qualiopi Manager — fondations.
-- Migration ADDITIVE uniquement (aucun DROP). Ajoute la catégorie `qualiopi`
-- à l'enum SiteSettingCategory pour porter les paramètres métier OF
-- (réutilisation de SiteSetting, remplace la table `config_systeme` des specs).

-- AlterEnum (idempotent — PostgreSQL 12+).
ALTER TYPE "SiteSettingCategory" ADD VALUE IF NOT EXISTS 'qualiopi';
