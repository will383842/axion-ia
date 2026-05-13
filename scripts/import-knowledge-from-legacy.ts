/**
 * Sprint KB-2 — Migration legacy Article → KnowledgeEntry (EXPAND-ONLY).
 *
 * Ce script LIT les tables legacy (`articles`, `article_translations`,
 * `article_tags`, `article_tags_on_articles`) et CRÉE des rows dans
 * `knowledge_entries`/`knowledge_translations`/`knowledge_tags`/
 * `knowledge_tags_on_entries` avec `type='article'`. AUCUNE table legacy
 * n'est modifiée ni supprimée — le contract (drop) viendra dans un sprint
 * dédié (KB-5+) après validation prod.
 *
 * Pattern aligné sur `scripts/import-insee-villes.ts` (style TS-X, dry-run
 * par défaut, --commit explicite, --batch-size).
 *
 * Usage :
 *   pnpm tsx scripts/import-knowledge-from-legacy.ts --dry-run   (default)
 *   pnpm tsx scripts/import-knowledge-from-legacy.ts --commit
 *   pnpm tsx scripts/import-knowledge-from-legacy.ts --commit --batch-size=50
 *
 * Source : `_AUDIT/KNOWLEDGE-BASE-2026/04-PLAN-EXECUTION.md` §KB-2.
 *
 * NOTE : KB-2 expand-only — autres types legacy (CaseStudy/FAQ/HelpArticle)
 *        + glossaire/guide-ia hardcode → Sprint KB-5 (décision Will).
 */

import { PrismaClient, type Prisma } from "../prisma/generated/client";
import {
  mapArticleToEntryInput,
  mapTranslationToKnowledgeTranslationInput,
  type ArticleWithRelations,
} from "../src/lib/knowledge/legacy-import-mapping";

const prisma = new PrismaClient();

interface MappingReport {
  articleId: string;
  legacySlug: string | null;
  entryId: string | null;
  status: "would-create" | "created" | "skipped-exists" | "error";
  message?: string;
}

interface RunOptions {
  dryRun: boolean;
  batchSize: number;
}

async function importArticleBatch(
  articles: ArticleWithRelations[],
  opts: RunOptions,
): Promise<MappingReport[]> {
  const reports: MappingReport[] = [];

  for (const article of articles) {
    const entryInput = mapArticleToEntryInput(article);

    const existing = await prisma.knowledgeEntry.findUnique({
      where: { slug: entryInput.slug },
      select: { id: true },
    });

    if (existing) {
      reports.push({
        articleId: article.id,
        legacySlug: entryInput.slug,
        entryId: existing.id,
        status: "skipped-exists",
        message: "slug already in knowledge_entries",
      });
      continue;
    }

    if (opts.dryRun) {
      reports.push({
        articleId: article.id,
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
            create: article.translations.map(
              (t) =>
                mapTranslationToKnowledgeTranslationInput(
                  t,
                ) as unknown as Prisma.KnowledgeTranslationCreateWithoutEntryInput,
            ),
          },
        },
        select: { id: true },
      });

      // Tags : upsert KnowledgeTag puis créer KnowledgeTagOnEntry.
      for (const at of article.tags) {
        const tag = await prisma.knowledgeTag.upsert({
          where: { slug: at.tag.slug },
          create: { slug: at.tag.slug, nameFr: at.tag.nameFr, nameEn: at.tag.nameEn },
          update: {},
        });
        await prisma.knowledgeTagOnEntry.create({
          data: { entryId: entry.id, tagId: tag.id },
        });
      }

      // Slug history : enregistre l'ancien slug comme pointer (zéro 301 ultérieur).
      await prisma.knowledgeSlugHistory.create({
        data: {
          oldLocale: "fr",
          oldType: "article",
          oldSlug: entryInput.slug,
          entryId: entry.id,
          reason: "legacy_db_migration_kb_02",
        },
      });

      reports.push({
        articleId: article.id,
        legacySlug: entryInput.slug,
        entryId: entry.id,
        status: "created",
      });
    } catch (err) {
      reports.push({
        articleId: article.id,
        legacySlug: entryInput.slug,
        entryId: null,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return reports;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--commit");
  const batchSizeArg = args.find((a) => a.startsWith("--batch-size="));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1] ?? "50", 10) : 50;
  const opts: RunOptions = { dryRun, batchSize };

  console.warn(`[kb-import] mode=${dryRun ? "DRY-RUN" : "COMMIT"} batchSize=${batchSize}`);

  const total = await prisma.article.count();
  console.warn(`[kb-import] articles legacy détectés : ${total}`);

  const allReports: MappingReport[] = [];
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.article.findMany({
      take: opts.batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      include: {
        translations: true,
        tags: { include: { tag: { select: { slug: true, nameFr: true, nameEn: true } } } },
      },
    });

    if (batch.length === 0) break;

    const reports = await importArticleBatch(batch as unknown as ArticleWithRelations[], opts);
    allReports.push(...reports);
    cursor = batch[batch.length - 1]?.id;
  }

  const counts = allReports.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<MappingReport["status"], number>,
  );

  console.warn("[kb-import] résumé :", counts);
  console.warn(`[kb-import] rapport JSON :`);
  console.warn(JSON.stringify(allReports, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[kb-import] FATAL", err);
  process.exit(1);
});
