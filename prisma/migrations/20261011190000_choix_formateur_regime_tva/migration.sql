-- Correctif L11b — le régime de TVA est figé AU CHOIX du formateur, avec le tarif et
-- le forfait de déplacement, puis recopié sur la mission à la proposition.
-- ADDITIVE seulement : une colonne nullable. Aucun DROP, aucune ligne touchée.
ALTER TABLE "choix_formateur_session" ADD COLUMN IF NOT EXISTS "regime_tva_fige" "TvaRegimeHonoraires";
