-- Sprint A-suite P6 — Items 3 & 4 (correlationId traceId + factCheckScore gate)
-- Additive migration — aucun impact sur les lignes existantes.
-- correlationId nullable → rétro-compatibilité totale avec les jobs existants.
-- factCheckScore nullable → gate ignoré si null (fact-check pas encore run).

ALTER TABLE "content_gen_jobs"
  ADD COLUMN IF NOT EXISTS "correlation_id" VARCHAR(36),
  ADD COLUMN IF NOT EXISTS "fact_check_score" INTEGER;
