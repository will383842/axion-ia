/**
 * Image-bank V1 — Seeds idempotents (entry point).
 *
 * Usage : `pnpm image-bank:seed`
 *
 * Ordre d'ingestion (FK ordering) :
 *   1. Country (~249 lignes, REST Countries API)
 *   2. ImageCategory + ImageCategoryTranslation (5 catégories FR+EN)
 *   3. ImageTag + ImageTagTranslation (10 tags FR+EN)
 *
 * Toutes les sous-fonctions utilisent `upsert` → run 2× = même résultat.
 */

import { PrismaClient } from "../../generated/client";
import { seedCountries } from "./seed-countries";
import { seedImageCategories } from "./seed-categories";
import { seedImageTags } from "./seed-tags";

const prisma = new PrismaClient();

async function main() {
  console.log("[image-bank seed] starting...");

  const countriesCount = await seedCountries(prisma as unknown as never);
  console.log(`  ✓ Country : ${countriesCount} rows upserted`);

  const categoriesCount = await seedImageCategories(prisma as unknown as never);
  console.log(`  ✓ ImageCategory : ${categoriesCount} rows upserted`);

  const tagsCount = await seedImageTags(prisma as unknown as never);
  console.log(`  ✓ ImageTag : ${tagsCount} rows upserted`);

  console.log("[image-bank seed] ✓ done.");
}

main()
  .catch((err) => {
    console.error("[image-bank seed] failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
