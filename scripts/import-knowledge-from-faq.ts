/**
 * KB-5 — Migration legacy `FAQ` → `KnowledgeEntry` type='faq'.
 * Particularité : FAQ legacy a question/answer inline FR+EN ; on génère 2 translations.
 *
 * Usage :
 *   pnpm tsx scripts/import-knowledge-from-faq.ts --dry-run
 *   pnpm tsx scripts/import-knowledge-from-faq.ts --commit
 */

import { PrismaClient, type Prisma } from "../prisma/generated/client";
import { mapFaqToEntryInput, mapFaqTranslations } from "../src/lib/knowledge/legacy-mapping-faq";

const prisma = new PrismaClient();

interface MappingReport {
  legacyId: string;
  legacySlug: string;
  entryId: string | null;
  status: "would-create" | "created" | "skipped-exists" | "error";
  message?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--commit");
  const batchSizeArg = args.find((a) => a.startsWith("--batch-size="));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1] ?? "50", 10) : 50;

  console.warn(`[kb-import:faq] mode=${dryRun ? "DRY-RUN" : "COMMIT"} batchSize=${batchSize}`);

  const total = await prisma.fAQ.count();
  console.warn(`[kb-import:faq] FAQ legacy détectées : ${total}`);

  const all: MappingReport[] = [];
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.fAQ.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (batch.length === 0) break;

    for (const faq of batch) {
      const entryInput = mapFaqToEntryInput(faq);
      const existing = await prisma.knowledgeEntry.findUnique({
        where: { slug: entryInput.slug },
        select: { id: true },
      });
      if (existing) {
        all.push({
          legacyId: faq.id,
          legacySlug: entryInput.slug,
          entryId: existing.id,
          status: "skipped-exists",
        });
        continue;
      }
      if (dryRun) {
        all.push({
          legacyId: faq.id,
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
              create: mapFaqTranslations(faq).map(
                (t) =>
                  ({
                    locale: t.locale,
                    title: t.title,
                    slug: t.slug,
                    body: t.body,
                    bodyText: t.bodyText,
                    excerpt: t.excerpt,
                    metaTitle: t.metaTitle,
                    metaDescription: t.metaDescription,
                  }) as unknown as Prisma.KnowledgeTranslationCreateWithoutEntryInput,
              ),
            },
          },
          select: { id: true },
        });
        await prisma.knowledgeSlugHistory.create({
          data: {
            oldLocale: "fr",
            oldType: "faq",
            oldSlug: entryInput.slug,
            entryId: entry.id,
            reason: "legacy_db_migration_kb_05_faq",
          },
        });
        all.push({
          legacyId: faq.id,
          legacySlug: entryInput.slug,
          entryId: entry.id,
          status: "created",
        });
      } catch (err) {
        all.push({
          legacyId: faq.id,
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
  console.warn("[kb-import:faq] résumé :", counts);
  console.warn(JSON.stringify(all, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[kb-import:faq] FATAL", err);
  process.exit(1);
});
