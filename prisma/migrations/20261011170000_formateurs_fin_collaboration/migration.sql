-- Lot L14 — fin de collaboration d'un formateur indépendant (ADR 0066, E25).
-- ADDITIVE seulement : six valeurs d'énumération et deux colonnes nullables. Aucun DROP,
-- aucune ligne touchée. Une instruction par valeur : une valeur ajoutée n'est utilisable
-- qu'après le COMMIT, aucune n'est employée dans cette migration.
ALTER TYPE "fin_collaboration_motif" ADD VALUE IF NOT EXISTS 'initiative_formateur';
ALTER TYPE "fin_collaboration_motif" ADD VALUE IF NOT EXISTS 'initiative_axion';
ALTER TYPE "fin_collaboration_motif" ADD VALUE IF NOT EXISTS 'siret_cesse';
ALTER TYPE "fin_collaboration_motif" ADD VALUE IF NOT EXISTS 'nda_caduc';
ALTER TYPE "fin_collaboration_motif" ADD VALUE IF NOT EXISTS 'manquement';
ALTER TYPE "fin_collaboration_motif" ADD VALUE IF NOT EXISTS 'deces';

-- Date d'effet (préavis compris) et note libre. Le CHECK `trainers_fin_collaboration_coherente`
-- (date, motif et auteur ensemble) est inchangé ; les nouvelles colonnes n'y entrent pas.
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "fin_collaboration_effet_at" TIMESTAMP(3);
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "fin_collaboration_note" TEXT;
