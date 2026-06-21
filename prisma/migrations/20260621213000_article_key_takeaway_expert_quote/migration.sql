-- Chantier templates 2026-06-21 — « Point clé » + « Citation expert nommé »
-- sur les articles générés (table `articles`).
--
-- Pourquoi : l'audit templates a montré que ces deux blocs manquaient à tous
-- les templates d'article. Plutôt que d'inventer du contenu, on crée la VRAIE
-- structure de données ; les blocs s'affichent uniquement une fois remplis avec
-- du contenu réel (admin / générateur).
--
-- Additif + nullable → safe : aucune réécriture, aucune valeur par défaut, pas
-- de verrou de table significatif. Aucun impact sur les lignes existantes.
ALTER TABLE "articles" ADD COLUMN "key_takeaway" TEXT;
ALTER TABLE "articles" ADD COLUMN "expert_quote_name" TEXT;
ALTER TABLE "articles" ADD COLUMN "expert_quote_title" TEXT;
ALTER TABLE "articles" ADD COLUMN "expert_quote_text" TEXT;
