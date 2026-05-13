/**
 * KB-5 — Migration legacy `CaseStudy` → `KnowledgeEntry` type='case_study'
 * Mode EXPAND-ONLY (table `case_studies` intacte, drop reporté KB-5+).
 *
 * Usage :
 *   pnpm tsx scripts/import-knowledge-from-case-study.ts --dry-run   (default)
 *   pnpm tsx scripts/import-knowledge-from-case-study.ts --commit
 */

import { PrismaClient, type Prisma } from "../prisma/generated/client";
import {
  mapCaseStudyToEntryInput,
  mapCaseStudyTranslationInput,
  type CaseStudyWithRelations,
} from "../src/lib/knowledge/legacy-mapping-case-study";

const prisma = new PrismaClient();

interface MappingReport {
  legacyId: string;
  legacySlug: string | null;
  entryId: string | null;
  status: "would-create" | "created" | "skipped-exists" | "error";
  message?: string;
}

async function importBatch(
  items: CaseStudyWithRelations[],
  dryRun: boolean,
): Promise<MappingReport[]> {
  const reports: MappingReport[] = [];
  for (const cs of items) {
    const entryInput = mapCaseStudyToEntryInput(cs);
    const existing = await prisma.knowledgeEntry.findUnique({
      where: { slug: entryInput.slug },
      select: { id: true },
    });
    if (existing) {
      reports.push({
        legacyId: cs.id,
        legacySlug: entryInput.slug,
        entryId: existing.id,
        status: "skipped-exists",
      });
      continue;
    }
    if (dryRun) {
      reports.push({
        legacyId: cs.id,
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
            create: cs.translations.map(
              (t) =>
                mapCaseStudyTranslationInput(
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
          oldType: "case_study",
          oldSlug: entryInput.slug,
          entryId: entry.id,
          reason: "legacy_db_migration_kb_05_case_study",
        },
      });
      reports.push({
        legacyId: cs.id,
        legacySlug: entryInput.slug,
        entryId: entry.id,
        status: "created",
      });
    } catch (err) {
      reports.push({
        legacyId: cs.id,
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

  console.warn(
    `[kb-import:case-study] mode=${dryRun ? "DRY-RUN" : "COMMIT"} batchSize=${batchSize}`,
  );

  const total = await prisma.caseStudy.count();
  console.warn(`[kb-import:case-study] case studies legacy détectés : ${total}`);

  const all: MappingReport[] = [];
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.caseStudy.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      include: { translations: true },
    });
    if (batch.length === 0) break;
    const reports = await importBatch(batch as unknown as CaseStudyWithRelations[], dryRun);
    all.push(...reports);
    cursor = batch[batch.length - 1]?.id;
  }

  const counts = all.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<MappingReport["status"], number>,
  );
  console.warn("[kb-import:case-study] résumé :", counts);
  console.warn(JSON.stringify(all, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[kb-import:case-study] FATAL", err);
  process.exit(1);
});
