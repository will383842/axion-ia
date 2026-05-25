/**
 * Sprint Quality 2026 — Phase 4 : test final 6 URLs Paris.
 *
 * 1. Re-gen hub Paris (avec KB doctrine + audience personas + anti-duplicate check)
 * 2. Gen 5 verticales Paris (interventions/audits/implementations/un-a-un/sites-web-ia)
 * 3. Persist Article + Translation + ContentGenJob (minimal pour les tests)
 * 4. Vérification HTTP 200 sur les 6 URLs
 * 5. Rapport stats consolidé
 *
 * Coût estimé : ~$0.60 (1 hub + 5 verticales).
 *
 * Usage :
 *   set -a && source .env.local && set +a && pnpm tsx src/scripts/test-paris-6-pages.ts
 */
import { prisma } from "@/lib/prisma";
import { generateVilleHubCopy } from "@/server/content-gen/generators/ville-hub-copy";
import { landingVilleByVerticalInterventionsGenerator } from "@/server/content-gen/generators/landing-ville-by-vertical-interventions";
import { landingVilleByVerticalAuditsGenerator } from "@/server/content-gen/generators/landing-ville-by-vertical-audits";
import { landingVilleByVerticalImplementationsGenerator } from "@/server/content-gen/generators/landing-ville-by-vertical-implementations";
import { landingVilleByVerticalUnAUnGenerator } from "@/server/content-gen/generators/landing-ville-by-vertical-un-a-un";
import { landingVilleByVerticalSitesWebIaGenerator } from "@/server/content-gen/generators/landing-ville-by-vertical-sites-web-ia";
import type { Generator, GeneratorBaseInput } from "@/server/content-gen/generators/types";

const VILLE_SLUG = "paris";
const AUTO_APPROVE_THRESHOLD = 70;

const VERTICALES: Array<{ slug: string; gen: Generator }> = [
  { slug: "interventions", gen: landingVilleByVerticalInterventionsGenerator },
  { slug: "audits", gen: landingVilleByVerticalAuditsGenerator },
  { slug: "implementations", gen: landingVilleByVerticalImplementationsGenerator },
  { slug: "un-a-un", gen: landingVilleByVerticalUnAUnGenerator },
  { slug: "sites-web-ia", gen: landingVilleByVerticalSitesWebIaGenerator },
];

async function genVerticale(
  slug: string,
  gen: Generator,
): Promise<{
  slug: string;
  wordCount: number;
  qualityScore: number;
  totalCostUsd: number;
  articleId: string | null;
}> {
  console.log(`\n▶ ${slug}…`);
  const t0 = Date.now();
  // Crée un ContentGenJob minimal pour traçabilité
  const job = await prisma.contentGenJob.create({
    data: {
      idempotencyKey: `test-paris-${slug}-${Date.now()}`,
      contentType: "landing_ville",
      status: "running",
      anchorVilleSlug: VILLE_SLUG,
      anchorRegionSlug: "ile-de-france",
      anchorDepartementCode: "75",
      targetSearchIntent: "commercial_investigation",
      targetAudienceSize: "PME",
      targetAudienceOrganisation: "entreprise_privee",
      // ⚠️ La clé doit être "templateVariant" pour que getLandingVilleArticleByVertical
      // (qui filtre `inputPayload: { path: ["templateVariant"], equals: verticale }`) trouve la row.
      inputPayload: { villeSlug: VILLE_SLUG, templateVariant: slug },
      targetLocale: "fr",
      primaryProvider: "openai",
    },
  });

  const input: GeneratorBaseInput = {
    jobId: job.id,
    contentType: "landing_ville",
    targetSearchIntent: "commercial_investigation",
    targetAudienceSize: "PME",
    targetAudienceOrganisation: "entreprise_privee",
    anchorVilleSlug: VILLE_SLUG,
    anchorRegionSlug: "ile-de-france",
    anchorDepartementCode: "75",
    primaryKeyword: `${slug} IA Paris`,
    templateVariant: slug,
  };

  let articleId: string | null = null;
  try {
    const output = await gen.generate(input);
    const durationMs = Date.now() - t0;
    console.log(
      `  score=${output.qualityScore}/100 words=${output.wordCount} cost=$${output.totalCostUsd.toFixed(4)} ${durationMs}ms`,
    );

    // Persist Article + Translation
    const article = await prisma.$transaction(async (tx) => {
      const a = await tx.article.create({
        data: {
          status: "published",
          publishedAt: new Date(),
          readingTime: output.readingTimeMinutes,
          indexationTier: output.indexationTier,
          qualityScore: output.qualityScore,
          seoScore: output.seoScore,
          readabilityScore: output.readabilityScore,
          generatedByJobId: job.id,
          ...(output.directAnswer ? { directAnswer: output.directAnswer } : {}),
          ...(output.faqJson ? { faqJson: output.faqJson as never } : {}),
          templateVariant: slug,
          searchIntent: "commercial_investigation",
          mentionedCities: [VILLE_SLUG],
        },
      });
      // Truncate metaTitle (VarChar 70) + metaDescription (VarChar 160) — LLM peut déborder
      const safeMetaTitle = output.metaTitle.slice(0, 70);
      const safeMetaDesc = output.metaDescription
        ? output.metaDescription.slice(0, 160)
        : undefined;
      const safeTitle = output.title.slice(0, 255);
      const safeSlug = output.slug.slice(0, 255);
      await tx.articleTranslation.create({
        data: {
          articleId: a.id,
          locale: "fr",
          title: safeTitle,
          slug: safeSlug,
          body: output.bodyHtml,
          ...(output.bodyText ? { bodyText: output.bodyText } : {}),
          metaTitle: safeMetaTitle,
          ...(safeMetaDesc ? { metaDescription: safeMetaDesc } : {}),
        },
      });
      await tx.contentGenJob.update({
        where: { id: job.id },
        data: {
          status: "published",
          completedAt: new Date(),
          durationMs,
          outputBlogPostId: a.id,
          qualityScore: output.qualityScore,
        },
      });
      return a;
    });
    articleId = article.id;
    return {
      slug,
      wordCount: output.wordCount,
      qualityScore: output.qualityScore,
      totalCostUsd: output.totalCostUsd,
      articleId,
    };
  } catch (err) {
    console.error(`  ✗ ÉCHEC ${slug}:`, err instanceof Error ? err.message : err);
    await prisma.contentGenJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) },
    });
    return { slug, wordCount: 0, qualityScore: 0, totalCostUsd: 0, articleId: null };
  }
}

async function checkUrl(url: string): Promise<{ url: string; status: number }> {
  try {
    const res = await fetch(url);
    return { url, status: res.status };
  } catch {
    return { url, status: 0 };
  }
}

async function main(): Promise<void> {
  console.log("=".repeat(80));
  console.log("SPRINT QUALITY 2026 — Test 6 URLs Paris");
  console.log("=".repeat(80));

  // Phase A : Hub
  console.log("\n[A] Hub generator…");
  const hubResult = await generateVilleHubCopy({ villeSlug: VILLE_SLUG });
  console.log(
    `  hub: score=${hubResult.qualityScore}/100 cost=$${hubResult.totalCostUsd.toFixed(4)}`,
  );
  if (hubResult.qualityScore >= AUTO_APPROVE_THRESHOLD) {
    await prisma.generatedVilleCopy.update({
      where: { villeSlug: VILLE_SLUG },
      data: { status: "approved", reviewedBy: "auto:sprint-quality-test", reviewedAt: new Date() },
    });
    console.log("  ✅ auto-approved");
  } else {
    // Approve quand même pour le test visuel
    await prisma.generatedVilleCopy.update({
      where: { villeSlug: VILLE_SLUG },
      data: { status: "approved", reviewedBy: "force:test-script", reviewedAt: new Date() },
    });
    console.log(`  ⚠️  score < ${AUTO_APPROVE_THRESHOLD} — forcé approved pour test visuel`);
  }

  // Phase B : 5 verticales
  console.log("\n[B] 5 verticales en parallèle…");
  const verticaleResults = await Promise.all(
    VERTICALES.map(({ slug, gen }) => genVerticale(slug, gen)),
  );

  // Phase C : HTTP check
  console.log("\n[C] HTTP check sur les 6 URLs…");
  const urls = [
    `http://localhost:3000/fr/implantations/ile-de-france/paris`,
    `http://localhost:3000/fr/implantations/ile-de-france/paris/interventions`,
    `http://localhost:3000/fr/implantations/ile-de-france/paris/audits`,
    `http://localhost:3000/fr/implantations/ile-de-france/paris/implementations`,
    `http://localhost:3000/fr/implantations/ile-de-france/paris/un-a-un`,
    `http://localhost:3000/fr/implantations/ile-de-france/paris/sites-web-ia`,
  ];
  const httpResults = await Promise.all(urls.map(checkUrl));

  // Phase D : Rapport
  console.log("\n" + "=".repeat(80));
  console.log("RAPPORT FINAL — Sprint Quality 2026 Paris");
  console.log("=".repeat(80));
  console.log(
    `\nHub :          score=${hubResult.qualityScore}/100 | $${hubResult.totalCostUsd.toFixed(4)}`,
  );
  let totalCost = hubResult.totalCostUsd;
  let totalWords = 0;
  console.log(`\nVerticales :`);
  for (const r of verticaleResults) {
    console.log(
      `  ${r.slug.padEnd(18, " ")} : score=${String(r.qualityScore).padStart(3, " ")}/100 | words=${String(r.wordCount).padStart(5, " ")} | $${r.totalCostUsd.toFixed(4)} | articleId=${r.articleId ? "✓" : "✗"}`,
    );
    totalCost += r.totalCostUsd;
    totalWords += r.wordCount;
  }
  console.log(`\nHTTP status :`);
  for (const h of httpResults) {
    console.log(`  ${h.status === 200 ? "✅" : "❌"} ${h.status} ${h.url}`);
  }
  console.log(`\nTOTAL COÛT : $${totalCost.toFixed(4)}`);
  console.log(`TOTAL MOTS VERTICALES : ${totalWords}`);
  console.log("=".repeat(80));
}

main()
  .catch((err) => {
    console.error("\n[FATAL]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
