/**
 * KB-5 — Migration legacy `HelpArticle` → `KnowledgeEntry` type='help_article'.
 *
 * Usage :
 *   pnpm tsx scripts/import-knowledge-from-help-article.ts --dry-run
 *   pnpm tsx scripts/import-knowledge-from-help-article.ts --commit
 */

import { PrismaClient, type Prisma } from "../prisma/generated/client";
import {
  mapHelpArticleToEntryInput,
  mapHelpArticleTranslationInput,
  type HelpArticleWithRelations,
} from "../src/lib/knowledge/legacy-mapping-help-article";

const prisma = new PrismaClient();

interface MappingReport {
  legacyId: string;
  legacySlug: string | null;
  entryId: string | null;
  status: "would-create" | "created" | "skipped-exists" | "error";
  message?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--commit");
  const batchSizeArg = args.find((a) => a.startsWith("--batch-size="));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1] ?? "50", 10) : 50;

  console.warn(`[kb-import:help] mode=${dryRun ? "DRY-RUN" : "COMMIT"} batchSize=${batchSize}`);

  const total = await prisma.helpArticle.count();
  console.warn(`[kb-import:help] help articles legacy détectés : ${total}`);

  const all: MappingReport[] = [];
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.helpArticle.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      include: { translations: true },
    });
    if (batch.length === 0) break;

    for (const ha of batch as unknown as HelpArticleWithRelations[]) {
      const entryInput = mapHelpArticleToEntryInput(ha);
      const existing = await prisma.knowledgeEntry.findUnique({
        where: { slug: entryInput.slug },
        select: { id: true },
      });
      if (existing) {
        all.push({
          legacyId: ha.id,
          legacySlug: entryInput.slug,
          entryId: existing.id,
          status: "skipped-exists",
        });
        continue;
      }
      if (dryRun) {
        all.push({
          legacyId: ha.id,
          legacySlug: entryInput.slug,
          entryId: null,
          status: "would-create",
        });
        continue;
      }
      try {
        const entry = await prisma.knowledgeEntry.create({
          data: {
            ...entryInput,
            translations: {
              create: ha.translations.map(
                (t) =>
                  mapHelpArticleTranslationInput(
                    t,
                  ) as unknown as Prisma.KnowledgeTranslationCreateWithoutEntryInput,
              ),
            },
          },
          select: { id: true },
        });
        await prisma.knowledgeSlugHistory.create({
          data: {
            oldLocale: "fr",
            oldType: "help_article",
            oldSlug: entryInput.slug,
            entryId: entry.id,
            reason: "legacy_db_migration_kb_05_help",
          },
        });
        all.push({
          legacyId: ha.id,
          legacySlug: entryInput.slug,
          entryId: entry.id,
          status: "created",
        });
      } catch (err) {
        all.push({
          legacyId: ha.id,
          legacySlug: entryInput.slug,
          entryId: null,
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    cursor = batch[batch.length - 1]?.id;
  }

  const counts = all.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<MappingReport["status"], number>,
  );
  console.warn("[kb-import:help] résumé :", counts);
  console.warn(JSON.stringify(all, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[kb-import:help] FATAL", err);
  process.exit(1);
});
