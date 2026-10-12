-- Lot D2 (M10, M22) — désaccord sur un relevé de mission, et anomalies du passage.
-- ADDITIVE seulement : cinq colonnes nullables. Aucun DROP, aucune ligne touchée.
--
-- Clôture d'un désaccord : `contestee_at` et `contestation_motif` restent tels quels
-- (le fait n'est jamais effacé). La clôture dit QUI, QUAND, COMMENT et POURQUOI.
-- Seule une clôture « non_retenue » débloque le paiement du relevé.
ALTER TABLE "trainer_statements"
  ADD COLUMN IF NOT EXISTS "contestation_close_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contestation_close_par_id" UUID,
  ADD COLUMN IF NOT EXISTS "contestation_close_issue" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "contestation_close_motif" TEXT,
  -- Anomalies constatées par le passage du paiement par mission (codes et
  -- chiffres seulement, aucune donnée personnelle), affichées sur l'écran du relevé.
  ADD COLUMN IF NOT EXISTS "anomalies_mission" JSONB;
