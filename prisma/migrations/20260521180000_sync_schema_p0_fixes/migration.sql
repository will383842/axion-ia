-- Sync migration — schema.prisma mis à jour pour refléter les corrections P0 du sprint P2.
-- Les colonnes/contraintes ci-dessous EXISTENT DÉJÀ en DB via les migrations précédentes
-- (20260521150000, 20260521150100, 20260521150200). Cette migration est un no-op SQL
-- qui enregistre la synchronisation schema.prisma ↔ DB dans l'historique Prisma.

-- P0-1 : generation_provenance FK ON DELETE RESTRICT (déjà appliqué via 20260521150000)
-- schema.prisma GenerationProvenance.article onDelete: Restrict → désormais sync.

-- P0-5 : keywords.locked_until + keywords.locked_by (déjà appliqué via 20260521150100)
-- schema.prisma Keyword.lockedUntil + Keyword.lockedBy → désormais sync.

-- P0-6 : articles.campaign_id nullable (déjà appliqué via 20260521150200)
-- schema.prisma Article.campaignId String? → désormais sync.

-- Aucune DDL requise : schéma déjà en place.
SELECT 1; -- no-op
