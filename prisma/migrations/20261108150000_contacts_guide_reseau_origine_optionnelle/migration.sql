-- Page « Recevoir le guide » — lot S2 v2 (2026-11-08) : l'ORIGINE n'est plus copiée dans
-- "contacts_guide_reseau". Elle vit dans "guide_reseau_origines" (historique v3) et au CRM Pro.
-- Les cinq colonnes d'origine deviennent NULLABLES ; le code ne les écrit plus.
--
-- ADDITIF : on RELÂCHE une contrainte (NOT NULL), on ne supprime ni colonne, ni table, ni ligne ;
-- aucune donnée n'est écrite. Aucun DROP de colonne / de table, aucun DELETE.
-- (La seule forme « DROP » est « ALTER COLUMN ... DROP NOT NULL », qui n'ôte que la contrainte.)
--
-- ORDRE DE LIVRAISON : cette migration doit être APPLIQUÉE AVANT que le code S2 v2 serve du
-- trafic (le code n'écrit plus ces colonnes : sur une base encore NOT NULL, l'INSERT échouerait).
-- L'entrypoint de l'app migre au démarrage ; le worker n'écrit pas dans cette table. Interrupteur
-- PAGE_GUIDE_RESEAU_ENABLED éteint par défaut : rien ne s'écrit avant son allumage, donc l'ordre
-- est sans risque tant qu'on ne l'allume qu'après l'atterrissage de l'app ET la migration.
-- Compatible avec l'ancien code : relâcher un NOT NULL ne casse aucune lecture ni aucune écriture.
-- Retour arrière : rollback.sql (refuse s'il existe une ligne sans origine).

ALTER TABLE "contacts_guide_reseau" ALTER COLUMN "mot" DROP NOT NULL;
ALTER TABLE "contacts_guide_reseau" ALTER COLUMN "reseau" DROP NOT NULL;
ALTER TABLE "contacts_guide_reseau" ALTER COLUMN "compte_ref" DROP NOT NULL;
ALTER TABLE "contacts_guide_reseau" ALTER COLUMN "version_m1" DROP NOT NULL;
-- "post_ref" est déjà NULLABLE depuis la création de la table.
