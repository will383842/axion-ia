-- Refonte Formations V2 — les 17 formations du catalogue deviennent réservables
-- sur /reserver. Ajout des 17 valeurs enum InterventionType (snake_case des
-- slugFr). Généré hors-ligne (worktree sans DB) ; s'applique via
-- `prisma migrate deploy`. Additif only (ADR 0020, aucun DROP). Aucune valeur
-- n'est UTILISÉE dans cette migration → sûr (Postgres : ADD VALUE non utilisé en tx).
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'ia_express';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'art_du_prompt';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'ia_securite';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'ia_conformite';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'ia_fondamentaux';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'ia_commercial';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'ia_au_bureau';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'ia_sur_le_terrain';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'automatisations_decouverte';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'ia_integration_metier';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'ia_commercial_avance';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'ia_transformation_equipe';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'agents_automatisations';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'agents_automatisations_avance';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'claude_decouverte';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'claude_createur';
ALTER TYPE "InterventionType" ADD VALUE IF NOT EXISTS 'claude_architecte';
