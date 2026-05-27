/**
 * E2E TEST PROD-LIKE — Inputs RICHES + Quality loop intégrée.
 *
 * Vise score ≥ 60 (tier_1_indexable) avec :
 *   - KB context auto via kbRetrieve interne du generator
 *   - Audience PME × entreprise_privee + intent ai_overview (AEO 2026)
 *   - PrimaryKeyword qui matche topics KB seedés (340 facts FR)
 *   - Quality loop interne (3 itérations + $0.15 cap)
 *
 * Sélectionne UNIQUEMENT les 4 generators avec quality_loop pour valider
 * le pattern complet : blog_article, comparison, blog_from_keywords, qa_derived.
 *
 * Budget cible : ~$0.60 (4 × $0.15 cap)
 */

import crypto from "node:crypto";
import { prisma } from "../../../src/lib/prisma";
import { getGenerator } from "../../../src/server/content-gen/generators";
import type { GeneratorBaseInput } from "../../../src/server/content-gen/generators/types";

interface TestCase {
  readonly id: string;
  readonly contentType: any;
  readonly primaryKeyword: string;
  readonly templateVariant: string;
  readonly searchIntent: any;
  readonly anchorVilleSlug?: string;
  readonly anchorRegionSlug?: string;
}

const TESTS: TestCase[] = [
  {
    id: "PROD-T1-blog-audit-ai-overview",
    contentType: "blog_article",
    primaryKeyword: "audit IA pour PME française : méthodologie complète et ROI mesurable",
    templateVariant: "audits",
    searchIntent: "ai_overview",
  },
  {
    id: "PROD-T2-comparison-vs-typical-consulting",
    contentType: "comparison",
    primaryKeyword: "Axion-IA vs cabinets de conseil traditionnels : comparaison méthodologie IA opérationnelle",
    templateVariant: "audits",
    searchIntent: "commercial_investigation",
  },
  {
    id: "PROD-T3-blog-keywords-formation-tpe",
    contentType: "blog_from_keywords",
    primaryKeyword: "formation intelligence artificielle TPE PME France 2026",
    templateVariant: "interventions",
    searchIntent: "informational",
  },
  {
    id: "PROD-T4-faq-standalone-rgpd-ia",
    contentType: "faq_standalone",
    primaryKeyword: "AI Act 2026 RGPD obligations conformité entreprises françaises",
    templateVariant: "audits",
    searchIntent: "featured_snippet",
  },
];

async function runOne(test: TestCase) {
  const t0 = Date.now();
  const jobId = crypto.randomUUID();
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`▶ ${test.id}`);
  console.log(`  contentType=${test.contentType} intent=${test.searchIntent}`);
  console.log(`  keyword="${test.primaryKeyword.slice(0, 80)}..."`);

  try {
    const cgJob = await prisma.contentGenJob.create({
      data: {
        idempotencyKey: `audit_prod_like_${test.id}_${Date.now()}`,
        contentType: test.contentType,
        status: "running",
        priority: 10,
        correlationId: jobId,
        inputPayload: {
          audit: "Sprint-v7-prod-like-2026-05-24",
          testCase: test.id,
          primaryKeyword: test.primaryKeyword,
        } as never,
        targetLocale: "fr",
        targetSearchIntent: test.searchIntent,
        primaryProvider: "openai",
        fallbackProvider: "anthropic",
        targetAudienceSize: "PME",
        targetAudienceOrganisation: "entreprise_privee",
        startedAt: new Date(),
        ...(test.anchorVilleSlug ? { anchorVilleSlug: test.anchorVilleSlug } : {}),
        ...(test.anchorRegionSlug ? { anchorRegionSlug: test.anchorRegionSlug } : {}),
      },
    });

    const input: GeneratorBaseInput = {
      jobId: cgJob.id,
      contentType: test.contentType,
      targetSearchIntent: test.searchIntent,
      targetAudienceSize: "PME",
      targetAudienceOrganisation: "entreprise_privee",
      primaryKeyword: test.primaryKeyword,
      templateVariant: test.templateVariant,
      ...(test.anchorVilleSlug ? { anchorVilleSlug: test.anchorVilleSlug } : {}),
      ...(test.anchorRegionSlug ? { anchorRegionSlug: test.anchorRegionSlug } : {}),
    };

    const generator = getGenerator(test.contentType);
    console.log(`  ⏳ Quality loop (max 3 iter, budget $0.15)…`);
    const output = await generator.generate(input);
    const durMs = Date.now() - t0;
    console.log(
      `  ✓ Output: ${output.wordCount}w | quality=${output.qualityScore}/100 | seo=${output.seoScore} | tier=${output.indexationTier} | $${(output.totalCostUsd ?? 0).toFixed(4)}`,
    );
    console.log(`    title="${output.title.slice(0, 70)}..."`);

    // Update job
    await prisma.contentGenJob.update({
      where: { id: cgJob.id },
      data: {
        status: "published",
        completedAt: new Date(),
        durationMs: durMs,
        qualityScore: output.qualityScore,
        seoScore: output.seoScore,
        readabilityScore: output.readabilityScore,
        tokensInput: output.tokensInput ?? 0,
        tokensOutput: output.tokensOutput ?? 0,
        costUsd: output.totalCostUsd ?? 0,
        outputJsonRaw: {
          title: output.title,
          metaTitle: output.metaTitle,
          metaDescription: output.metaDescription,
          slug: output.slug,
          directAnswer: output.directAnswer,
          bodyHtml: output.bodyHtml,
          bodyText: output.bodyText,
          faq: output.faq,
          tags: output.tags,
        } as never,
      },
    });

    return {
      id: test.id,
      status: "PASS",
      contentType: test.contentType,
      jobId: cgJob.id,
      slug: output.slug,
      title: output.title,
      wordCount: output.wordCount,
      qualityScore: output.qualityScore,
      seoScore: output.seoScore,
      readabilityScore: output.readabilityScore,
      indexationTier: output.indexationTier,
      costUsd: output.totalCostUsd ?? 0,
      durationMs: durMs,
    };
  } catch (err) {
    const durMs = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ FAIL after ${(durMs / 1000).toFixed(1)}s: ${msg.slice(0, 200)}`);
    return {
      id: test.id,
      status: "FAIL",
      contentType: test.contentType,
      durationMs: durMs,
      error: msg.slice(0, 300),
    };
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   PROD-LIKE E2E — 4 generators avec quality_loop intégré     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const results = [];
  for (const t of TESTS) {
    results.push(await runOne(t));
  }

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                  SUMMARY                                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  const pass = results.filter((r: any) => r.status === "PASS");
  const tier1 = pass.filter((r: any) => r.indexationTier === "tier_1_indexable");
  const tier2 = pass.filter((r: any) => r.indexationTier === "tier_2_noindex_follow");
  const tier3 = pass.filter((r: any) => r.indexationTier === "tier_3_noindex_nofollow");
  const totalCost = pass.reduce((s: number, r: any) => s + (r.costUsd ?? 0), 0);
  console.log(`Generated : ${pass.length}/${results.length}`);
  console.log(`Tier 1 (indexable) : ${tier1.length}`);
  console.log(`Tier 2 (noindex follow) : ${tier2.length}`);
  console.log(`Tier 3 (noindex nofollow) : ${tier3.length}`);
  console.log(`Total cost : $${totalCost.toFixed(4)}`);

  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : "✗";
    console.log(
      `  ${icon} ${r.id} | ${r.contentType} | ${
        r.status === "PASS"
          ? `score=${(r as any).qualityScore}/100 tier=${(r as any).indexationTier} ${(r as any).wordCount}w`
          : `err: ${(r as any).error?.slice(0, 80)}`
      }`,
    );
  }

  const fs = await import("node:fs/promises");
  await fs.writeFile(
    "_AUDIT/SPRINT-V7-RUNTIME-2026-05-23/prod-like-results.json",
    JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
  );

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
