/**
 * Seed Keyword table — 747 seeds depuis src/content/keywords/*.ts (B.5 P1.5).
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
 * Idempotent : `upsert` by `term` unique constraint. Run 2× = meme resultat.
 * Conserve `usageCount` + `lastUsedAt` existants (rotation continue apres re-seed).
 *
 * Usage : `pnpm content-gen:seed` (inclus via prisma/seeds/content-gen/index.ts).
 */

import type { PrismaClient } from "../../generated/client";
import { ALL_KEYWORD_SEEDS } from "../../../src/content/keywords/master";
import type { KeywordModule, KeywordSeed } from "../../../src/content/keywords/types";

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
 * Seed 747 keywords dans la table `keywords`.
 *
 * Retourne le nombre de rows upsertes (create + update).
 */
export async function seedKeywords(prisma: PrismaClient): Promise<number> {
  let upserted = 0;
  const skipped: string[] = [];

  for (const seed of ALL_KEYWORD_SEEDS as readonly KeywordSeed[]) {
    const vertical = MODULE_TO_VERTICAL[seed.module];
    if (!vertical) {
      skipped.push(seed.keyword);
      continue;
    }

    await prisma.keyword.upsert({
      where: { term: seed.keyword },
      // Conserve usageCount/lastUsedAt en cas de re-seed (rotation continue).
      update: {
        termNormalized: normalizeTerm(seed.keyword),
        vertical,
        searchIntent: seed.intent,
        isLongTail: seed.niveau === 3,
      },
      create: {
        term: seed.keyword,
        termNormalized: normalizeTerm(seed.keyword),
        vertical,
        searchIntent: seed.intent,
        isLongTail: seed.niveau === 3,
        isLocal: seed.intent === "local",
        cityIds: [],
      },
    });
    upserted += 1;
  }

  if (skipped.length > 0) {
    console.warn(
      `[seed-keywords] ${skipped.length} keywords skipped (module non mappe): ${skipped.slice(0, 3).join(", ")}…`,
    );
  }

  return upserted;
}
