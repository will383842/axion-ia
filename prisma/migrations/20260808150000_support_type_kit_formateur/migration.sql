-- Le kit formateur imprimé rejoint les supports pédagogiques.
--
-- Additif : une valeur d'enum en plus, aucune donnée touchée. Le kit n'est pas
-- produit par le Formation Engine (son `contenu` reste vide) — il est écrit à
-- la main dans `_KIT/<slug>/` puis publié sur R2 par
-- `scripts/kit-formateur/publier-vers-r2.ts`, qui pose `pdf_key`.
ALTER TYPE "SupportType" ADD VALUE IF NOT EXISTS 'kit_formateur_imprime';
