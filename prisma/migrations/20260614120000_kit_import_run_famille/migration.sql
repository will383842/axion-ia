-- Import de kit : mémorise la FAMILLE ciblée (formation | un_a_un | audit) pour
-- aiguiller le mapping dossier→slots dans le worker.
-- Additif et rétrocompatible : défaut 'formation' (comportement historique).
-- L'enum "InterventionFamille" existe déjà (migration 20260613120000_intervention_documents).
ALTER TABLE "kit_import_runs"
  ADD COLUMN "famille" "InterventionFamille" NOT NULL DEFAULT 'formation';
