-- Archivage explicite réversible des campagnes de couverture (2026-07-03).
-- Additif et non destructif : colonne nullable + index. Aucune donnée existante
-- impactée (archivedAt = NULL → toutes les campagnes actuelles restent "actives").
ALTER TABLE "coverage_campaigns" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "coverage_campaigns_archivedAt_idx" ON "coverage_campaigns"("archivedAt");
