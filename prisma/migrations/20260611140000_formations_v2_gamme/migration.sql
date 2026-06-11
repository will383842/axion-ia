-- Catalogue formations V2 — additif (offres Qualiopi des 17 formations).
-- Généré hors-ligne via `prisma migrate diff` (worktree sans DB). S'applique au
-- deploy via `prisma migrate deploy`. Aucune valeur enum nouvelle n'est UTILISÉE
-- dans cette migration (sûr en transaction). Aucun DROP — additif only (ADR 0020).

-- AlterEnum : nouveau format pédagogique « 3 jours » (IA Transformation, Agents/Claude 3j).
ALTER TYPE "OffreFormatPedagogique" ADD VALUE 'collectif_3jours';

-- AlterTable : axes catalogue V2 + tier_id devient nullable (les offres V2 n'ont
-- pas de tier pricing.ts ; leur prix dérive de FORMATION_PRICE_MATRIX via gamme+dureeCode).
ALTER TABLE "offres_site" ADD COLUMN     "duree_code" VARCHAR(8),
ADD COLUMN     "gamme" VARCHAR(40),
ALTER COLUMN "tier_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "offres_site_gamme_idx" ON "offres_site"("gamme");
