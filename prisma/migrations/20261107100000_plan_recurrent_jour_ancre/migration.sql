-- Additif et non destructif : jour d'ancrage de la 1re génération d'un plan récurrent.
ALTER TABLE "plans_recurrents" ADD COLUMN IF NOT EXISTS "jour_ancre" INTEGER;
