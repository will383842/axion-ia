/**
 * KB-5 — Import Glossaire hardcode → `KnowledgeEntry` type='glossary_term'.
 *
 * Source : SSOT `src/lib/knowledge/legacy-mapping-glossary-hardcode.ts`
 * (12 termes IA snapshot 2026-05-13 depuis `src/app/[locale]/glossaire/page.tsx`).
 *
 * Décision Will 2026-05-13 (Q3 SYNTHESIS) : migrer en DB dès KB-5.
 * Le composant page.tsx sera refactoré en Sprint KB-6 (lecture DB).
 *
 * Statut import : status='published' direct (les 12 termes sont déjà publics
 * via glossaire/page.tsx). audience='public', confidentiality='public'.
 *
 * Usage :
 *   pnpm tsx scripts/import-knowledge-from-glossary-hardcode.ts --dry-run
 *   pnpm tsx scripts/import-knowledge-from-glossary-hardcode.ts --commit
 */

import { PrismaClient, type Prisma } from "../prisma/generated/client";
import {
  GLOSSARY_TERMS_HARDCODE,
  mapGlossaryTermInput,
} from "../src/lib/knowledge/legacy-mapping-glossary-hardcode";

const prisma = new PrismaClient();

interface MappingReport {
  termSlug: string;
  entryId: string | null;
  status: "would-create" | "created" | "skipped-exists" | "error";
  message?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--commit");

  console.warn(`[kb-import:glossary] mode=${dryRun ? "DRY-RUN" : "COMMIT"}`);
  console.warn(`[kb-import:glossary] termes hardcode détectés : ${GLOSSARY_TERMS_HARDCODE.length}`);

  const all: MappingReport[] = [];

  for (const term of GLOSSARY_TERMS_HARDCODE) {
    const input = mapGlossaryTermInput(term);
    const existing = await prisma.knowledgeEntry.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existing) {
      all.push({ termSlug: input.slug, entryId: existing.id, status: "skipped-exists" });
      continue;
    }
    if (dryRun) {
      all.push({ termSlug: input.slug, entryId: null, status: "would-create" });
      continue;
    }
    try {
      const entry = await prisma.knowledgeEntry.create({
        data: {
          type: "glossary_term",
          domain: "editorial",
          audience: "public",
          confidentiality: "public",
          status: "published",
          pipelineStage: "published",
          slug: input.slug,
          publishedAt: new Date(),
          translations: {
            create: input.translations.map(
              (t) =>
                ({
                  locale: t.locale,
                  title: t.title,
                  slug: t.slug,
                  body: t.body,
                  bodyText: t.bodyText,
                  excerpt: t.excerpt,
                }) as unknown as Prisma.KnowledgeTranslationCreateWithoutEntryInput,
            ),
          },
        },
        select: { id: true },
      });
      await prisma.knowledgeSlugHistory.create({
        data: {
          oldLocale: "fr",
          oldType: "glossary_term",
          oldSlug: input.slug,
          entryId: entry.id,
          reason: "legacy_source_migration_kb_05_glossary_hardcode",
        },
      });
      all.push({ termSlug: input.slug, entryId: entry.id, status: "created" });
    } catch (err) {
      all.push({
        termSlug: input.slug,
        entryId: null,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const counts = all.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<MappingReport["status"], number>,
  );
  console.warn("[kb-import:glossary] résumé :", counts);
  console.warn(JSON.stringify(all, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[kb-import:glossary] FATAL", err);
  process.exit(1);
});
