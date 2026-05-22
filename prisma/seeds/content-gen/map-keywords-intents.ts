/**
 * Script mapping heuristique : Keyword.searchIntent ← classifyKeywordIntent()
 *
 * Phase D Sprint Perfection 2026-05-22.
 *
 * Règles heuristiques :
 *   - voice_search  : keyword commence par mot interrogatif + ≥ 4 mots
 *   - ai_overview   : contient "qu'est-ce que", "définition", "expliquer"
 *   - featured_snippet : 2-4 mots courts, intent informationnel direct, pas local
 *
 * Idempotent : met à jour uniquement les rows sans searchIntent ou avec
 * searchIntent = 'informational' si la heuristique est plus précise.
 *
 * Usage : `pnpm content-gen:map-intents`
 */

import { PrismaClient } from "../../generated/client";
import { classifyKeywordIntent } from "../../../src/server/content-gen/shared/intent-prompt-adapter";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const keywords = await prisma.keyword.findMany({
    select: { id: true, term: true, searchIntent: true },
  });

  console.log(`[map-intents] ${keywords.length} keywords à analyser`);

  let updated = 0;
  let skipped = 0;

  for (const kw of keywords) {
    const newIntent = classifyKeywordIntent(kw.term);
    if (!newIntent) {
      skipped++;
      continue;
    }

    // Ne pas écraser un intent déjà précis (voice/ai_overview/featured_snippet)
    const alreadyPrecise = ["voice_search", "ai_overview", "featured_snippet"].includes(
      kw.searchIntent ?? "",
    );
    if (alreadyPrecise) {
      skipped++;
      continue;
    }

    await prisma.keyword.update({
      where: { id: kw.id },
      data: { searchIntent: newIntent },
    });

    updated++;
  }

  console.log(`[map-intents] ${updated} keywords mis à jour, ${skipped} skippés`);
}

main()
  .catch((e) => {
    console.error("[map-intents] FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
