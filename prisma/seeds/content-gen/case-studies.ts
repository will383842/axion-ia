/**
 * Seeder — CaseStudy + CaseStudyTranslation (Sprint S+5 P2-5, 2026-05-20).
 *
 * Lit les 5 fixtures TS depuis `src/content/case-studies.ts` et les upsert
 * dans la DB. Idempotent : 2 runs successifs produisent le même état.
 *
 * Stratégie d'identité (CaseStudy.id étant un uuid auto-généré) :
 *   - Lookup CaseStudyTranslation par `{ locale: "fr", slug: <fixture.slug> }`
 *     (unique composite). Si trouvé → update du parent. Sinon → create.
 *
 * Mapping fixture → Prisma :
 *   - fixture.slug                  → CaseStudyTranslation.slug (FR + EN)
 *   - fixture.industry / industryEn → CaseStudy.sector (FR canonique)
 *   - fixture.size                  → CaseStudy.companySizeRange
 *   - fixture.geoSlug               → CaseStudy.region (slug ville/france)
 *   - fixture.datePublished         → CaseStudy.publishedAt
 *   - fixture.metric                → resultsQuantified.headlineMetric
 *
 * Status : published (les 5 fixtures sont visibles publiquement V1).
 *
 * NB : Le seeder n'ingère PAS la copy translation complète (title/problem/
 * solution/excerpt) — ce contenu est édité via Tiptap admin V2 en prod et
 * doit pas être écrasé sur re-seed. Le seeder crée des translations minimales
 * pour permettre l'unicité par slug, puis Will publie la copy via /admin.
 * Si la translation existe déjà, elle est laissée intacte.
 */

import type { PrismaClient } from "../../generated/client";
import { CASE_STUDIES } from "../../../src/content/case-studies";

export async function seedCaseStudies(prisma: PrismaClient): Promise<{
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
}> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const fixture of CASE_STUDIES) {
    // Lookup translation FR par slug — clé d'identité stable.
    const existingTranslation = await prisma.caseStudyTranslation
      .findUnique({
        where: { locale_slug: { locale: "fr", slug: fixture.slug } },
        select: { caseStudyId: true },
      })
      .catch(() => null);

    const parentData = {
      sector: fixture.industry.slice(0, 100),
      companySizeRange: fixture.size,
      region: fixture.geoSlug ?? null,
      modulesUsed: [] as never,
      resultsQuantified: {
        headlineMetric: fixture.metric,
      } as never,
      status: "published" as const,
      publishedAt: fixture.datePublished ? new Date(fixture.datePublished) : null,
    };

    if (existingTranslation?.caseStudyId) {
      // Update parent metadata (région, metric, dates). Ne touche pas aux
      // translations (copy éditée admin).
      await prisma.caseStudy.update({
        where: { id: existingTranslation.caseStudyId },
        data: parentData,
      });
      updated += 1;
      skipped += 1; // translations skipped
      continue;
    }

    // Create CaseStudy + 2 translations minimales (FR + EN).
    await prisma.caseStudy.create({
      data: {
        ...parentData,
        translations: {
          create: [
            {
              locale: "fr",
              slug: fixture.slug,
              title: fixture.fr.title.slice(0, 255),
              problem: fixture.fr.problem,
              solution: fixture.fr.solution,
              metaTitle: fixture.fr.title.slice(0, 70),
              metaDescription: fixture.fr.excerpt.slice(0, 160),
            },
            {
              locale: "en",
              slug: fixture.slug,
              title: fixture.en.title.slice(0, 255),
              problem: fixture.en.problem,
              solution: fixture.en.solution,
              metaTitle: fixture.en.title.slice(0, 70),
              metaDescription: fixture.en.excerpt.slice(0, 160),
            },
          ],
        },
      },
    });
    created += 1;
  }

  return { created, updated, skipped };
}
