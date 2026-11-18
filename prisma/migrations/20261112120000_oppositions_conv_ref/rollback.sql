-- ⚠️ RETOUR ARRIÈRE : perd toutes les marques « STOP reçu avant la page ».
-- Les personnes concernées pourraient de nouveau recevoir le guide si elles valident ensuite la page.
-- AVANT de l'exécuter, garder la liste (références hachées, jamais d'adresse) :
--   SELECT conv_ref, cree_le FROM oppositions_conv_ref;
-- Éteindre d'abord le code qui lit la table (redéployer l'ancienne version), puis :
DROP TABLE IF EXISTS "oppositions_conv_ref";
