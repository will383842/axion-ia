-- Fondation P1/P2 (2026-06-25) — additif uniquement.
-- Colonne keywords.campaign_id (nullable, rétro-compat) pour isoler les pools de
-- mots-clés par campagne. La logique de câblage n'est PAS posée ici (colonne seule).
-- Idempotent.
ALTER TABLE "keywords" ADD COLUMN IF NOT EXISTS "campaign_id" TEXT;

CREATE INDEX IF NOT EXISTS "keywords_campaign_id_idx" ON "keywords"("campaign_id");
