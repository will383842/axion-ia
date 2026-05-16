-- Add ServiceSector enum + serviceSector field on CoverageCampaign
-- and CoverageDistributionProfile (§ 25.3 — 3 piliers cabinet Axion-IA).
--
-- Pas de backfill : les campagnes pré-2026-05-16 et les profils existants
-- gardent serviceSector=NULL (rétro-compat). Les nouvelles campagnes
-- éditoriales doivent renseigner le secteur (validé Server Action côté code).

-- CreateEnum
CREATE TYPE "ServiceSector" AS ENUM ('interventions_formations', 'audits', 'implementations');

-- AlterTable
ALTER TABLE "coverage_campaigns" ADD COLUMN "serviceSector" "ServiceSector";

-- AlterTable
ALTER TABLE "coverage_distribution_profiles" ADD COLUMN "serviceSector" "ServiceSector";

-- CreateIndex
CREATE INDEX "coverage_campaigns_serviceSector_status_idx" ON "coverage_campaigns"("serviceSector", "status");

-- CreateIndex
CREATE INDEX "coverage_distribution_profiles_serviceSector_idx" ON "coverage_distribution_profiles"("serviceSector");
