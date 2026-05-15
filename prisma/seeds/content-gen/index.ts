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
