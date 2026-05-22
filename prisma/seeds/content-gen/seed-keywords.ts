/**
 * Seed Keyword table — depuis src/content/keywords/*.ts (B.5 P1.5).
 *
 * Mapping KeywordModule → vertical (ServiceSector) :
 *   - "audit" → "audits"
 *   - "interventions-formations" → "interventions_formations"
 *   - "implementation" → "implementations"
 *   - "coaching-1-to-1" → "un_a_un"
 *   - "codage-developpement" → "sites_web_augmentes"
 *   - "maintenance-ia" → "transversal" (pas de verticale dediee)
 *   - "transversal" → "transversal"
 *
 * V-12 P1 (2026-05-22) — peuple aussi :
 *   - `clusterId` via assignClusterId() (catalogue 25 + transversal)
 *   - `cityIds[]` (codes INSEE) via extractCityInseeCodes() pour keywords géo
 *   - `isLocal` étendu : keyword géo détecté OU intent="local"
 *
 * Idempotent : `upsert` by `term` unique constraint. Run 2× = meme resultat.
 * Conserve `usageCount` + `lastUsedAt` existants (rotation continue apres re-seed).
 *
 * Usage : `pnpm content-gen:seed` (inclus via prisma/seeds/content-gen/index.ts).
 */

import type { PrismaClient } from "../../generated/client";
import { ALL_KEYWORD_SEEDS } from "../../../src/content/keywords/master";
import type { KeywordModule, KeywordSeed } from "../../../src/content/keywords/types";
import { assignClusterId } from "../../../src/content/keywords/clusters";
import { extractCityInseeCodes } from "../../../src/content/keywords/geo-cities";

const MODULE_TO_VERTICAL: Record<KeywordModule, string> = {
  audit: "audits",
  "interventions-formations": "interventions_formations",
  implementation: "implementations",
  "coaching-1-to-1": "un_a_un",
  "codage-developpement": "sites_web_augmentes",
  "maintenance-ia": "transversal",
  transversal: "transversal",
};

function normalizeTerm(term: string): string {
  return term.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ");
}

/**
 * Stats agrégés retournés par le seeder.
 */
export interface SeedKeywordsResult {
  upserted: number;
  withCluster: number;
  withCityIds: number;
  geoKeywordsTotal: number;
  skipped: number;
}

/**
 * Seed des keywords dans la table `keywords`.
 *
 * Peuple `clusterId` + `cityIds[]` + `isLocal` selon V-12 P1.
 */
export async function seedKeywords(prisma: PrismaClient): Promise<SeedKeywordsResult> {
  let upserted = 0;
  let withCluster = 0;
  let withCityIds = 0;
  let geoKeywordsTotal = 0;
  const skipped: string[] = [];

  for (const seed of ALL_KEYWORD_SEEDS as readonly KeywordSeed[]) {
    const vertical = MODULE_TO_VERTICAL[seed.module];
    if (!vertical) {
      skipped.push(seed.keyword);
      continue;
    }

    const clusterId = assignClusterId(seed);
    const cityIds = extractCityInseeCodes(seed.keyword, seed.urlCible);
    const isLocal = seed.intent === "local" || cityIds.length > 0;

    if (clusterId) withCluster += 1;
    if (cityIds.length > 0) withCityIds += 1;
    if (isLocal) geoKeywordsTotal += 1;

    await prisma.keyword.upsert({
      where: { term: seed.keyword },
      // Conserve usageCount/lastUsedAt en cas de re-seed (rotation continue).
      update: {
        termNormalized: normalizeTerm(seed.keyword),
        vertical,
        searchIntent: seed.intent,
        isLongTail: seed.niveau === 3,
        isLocal,
        cityIds,
        clusterId,
      },
      create: {
        term: seed.keyword,
        termNormalized: normalizeTerm(seed.keyword),
        vertical,
        searchIntent: seed.intent,
        isLongTail: seed.niveau === 3,
        isLocal,
        cityIds,
        clusterId,
      },
    });
    upserted += 1;
  }

  if (skipped.length > 0) {
    console.warn(
      `[seed-keywords] ${skipped.length} keywords skipped (module non mappe): ${skipped.slice(0, 3).join(", ")}…`,
    );
  }

  return { upserted, withCluster, withCityIds, geoKeywordsTotal, skipped: skipped.length };
}
