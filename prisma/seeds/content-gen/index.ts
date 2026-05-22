/**
 * Content Generator V1 — Seeds idempotents (entry point).
 *
 * Sprint 1 Day 1 AGT-A step 13:00 (cf. SPRINT-1-DAY-BY-DAY.md v2.5).
 * Tous les sous-modules utilisent `upsert` → run 2× = même résultat.
 *
 * Usage : `pnpm content-gen:seed` (script ajouté Day 4 § 16:00).
 *
 * Ordre d'ingestion (FK ordering) :
 *   1. ProviderConfig (5 rows)
 *   2. CoverageDistributionProfile (3 rows)
 *   3. AudienceMixProfile (4 rows)
 *   4. AuthorProfile (1 row Manon)
 *   5. BannedPhrase (~50 rows doctrine)
 *   6. ContentTemplate (9 stub templates — system prompts complets Day 3)
 *
 * RssSource seedé Sprint 2 (migration add_rss_pipeline).
 */

import { PrismaClient } from "../../generated/client";
import { seedProviderConfig } from "./provider-config";
import { seedCoverageDistributionProfiles } from "./coverage-distribution-profiles";
import { seedAudienceMixProfiles } from "./audience-mix-profiles";
import { seedAuthorProfile } from "./author-profile";
import { seedBannedPhrases } from "./banned-phrases";
import { seedContentTemplates } from "./content-templates";
import { seedContentGenConfig } from "./content-gen-config";
import { seedSectorCampaigns } from "./sector-campaigns";
import { seedRssSources } from "./rss-sources";
import { seedCaseStudies } from "./case-studies";
import { seedKeywords } from "./seed-keywords";
import { seedKbFacts } from "./seed-kb-facts";

const prisma = new PrismaClient();

async function main() {
  console.log("[content-gen seed] starting...");

  const providerConfigCount = await seedProviderConfig(prisma);
  console.log(`  ✓ ProviderConfig : ${providerConfigCount} rows upserted`);

  const distributionCount = await seedCoverageDistributionProfiles(prisma);
  console.log(`  ✓ CoverageDistributionProfile : ${distributionCount} rows upserted`);

  const audienceCount = await seedAudienceMixProfiles(prisma);
  console.log(`  ✓ AudienceMixProfile : ${audienceCount} rows upserted`);

  const manonResult = await seedAuthorProfile(prisma);
  console.log(
    `  ✓ AuthorProfile : ${manonResult.slug} upserted (aiGenerated=${manonResult.aiGenerated})`,
  );

  const bannedCount = await seedBannedPhrases(prisma);
  console.log(`  ✓ BannedPhrase : ${bannedCount} rows upserted`);

  const templatesCount = await seedContentTemplates(prisma);
  console.log(`  ✓ ContentTemplate : ${templatesCount} rows upserted`);

  const configCount = await seedContentGenConfig(prisma);
  console.log(`  ✓ ContentGenConfig : ${configCount} keys upserted`);

  const sectorCount = await seedSectorCampaigns(prisma);
  console.log(`  ✓ CoverageCampaign (sectorielles, draft) : ${sectorCount} rows upserted`);

  // Sprint S+5 P2-3 — Migration RSS sources legacy ContentGenConfig → RssSource.
  const rssCount = await seedRssSources(prisma);
  console.log(`  ✓ RssSource : ${rssCount} rows upserted (migration legacy ContentGenConfig)`);

  // Sprint S+5 P2-5 — CaseStudy (5 fixtures TS → DB, idempotent).
  const caseStudies = await seedCaseStudies(prisma);
  console.log(
    `  ✓ CaseStudy : ${caseStudies.created} created, ${caseStudies.updated} updated, ${caseStudies.skipped} translations skipped`,
  );

  // P1.5 B.5 P0-7 — 747 keyword seeds (rotation atomique pipeline content-gen).
  const keywordCount = await seedKeywords(prisma);
  console.log(`  ✓ Keyword : ${keywordCount} rows upserted (rotation pipeline content-gen)`);

  // P4 Sprint — KB facts sectoriels (verticale audits pilote, 10 facts vérifiés).
  const kbFactsCount = await seedKbFacts(prisma);
  console.log(
    `  ✓ KbFacts (audits) : ${kbFactsCount} entries upserted (KnowledgeEntry + Translation FR)`,
  );

  console.log("[content-gen seed] done.");
}

main()
  .catch((e) => {
    console.error("[content-gen seed] FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
