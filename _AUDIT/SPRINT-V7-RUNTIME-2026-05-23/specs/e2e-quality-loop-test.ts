/**
 * Test E2E POST-FIX qualité — Vise tier_2 minimum après refactor v7-phase8 + landing-ville
 * avec quality_loop intégré (3 iter + $0.15 cap, KB retrieve, external links 4).
 *
 * 4 articles divers (3 Phase 8 v7 + 1 landing_ville) pour vérifier que le
 * quality_loop converge vers score ≥ 60 + tier_2_noindex_follow.
 *
 * Budget cible : ~$0.60.
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
    id: "QL-T1-case-study-paris",
    contentType: "case_study_local",
    primaryKeyword: "cas concret implémentation IA PME française tertiaire",
    templateVariant: "interventions",
    searchIntent: "commercial_investigation",
    anchorVilleSlug: "paris",
    anchorRegionSlug: "ile-de-france",
  },
  {
    id: "QL-T2-how-to-rag",
    contentType: "how_to_x_in_y",
    primaryKeyword: "comment déployer un RAG pour la documentation interne entreprise",
    templateVariant: "implementations",
    searchIntent: "informational",
  },
  {
    id: "QL-T3-glossary-llm",
    contentType: "glossary_term",
    primaryKeyword: "Large Language Model définition usage entreprise",
    templateVariant: "implementations",
    searchIntent: "informational",
  },
  {
    id: "QL-T4-landing-audits-lyon",
    contentType: "landing_ville",
    primaryKeyword: "audit IA Lyon PME industrielle",
    templateVariant: "audits",
    searchIntent: "local",
    anchorVilleSlug: "lyon",
    anchorRegionSlug: "auvergne-rhone-alpes",
  },
];

async function runOne(test: TestCase) {
  const t0 = Date.now();
  const jobId = crypto.randomUUID();
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`▶ ${test.id}`);
  console.log(`  contentType=${test.contentType} intent=${test.searchIntent}`);
  console.log(`  keyword="${test.primaryKeyword.slice(0, 80)}..."`);
  console.log(`  ⏳ Quality loop (max 3 iter)…`);

  try {
    const cgJob = await prisma.contentGenJob.create({
      data: {
        idempotencyKey: `audit_quality_loop_${test.id}_${Date.now()}`,
        contentType: test.contentType,
        status: "running",
        priority: 10,
        correlationId: jobId,
        inputPayload: {
          audit: "Sprint-v7-quality-loop-2026-05-24",
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
    const output = await generator.generate(input);
    const durMs = Date.now() - t0;
    console.log(
      `  ✓ ${output.wordCount}w | quality=${output.qualityScore}/100 seo=${output.seoScore} read=${output.readabilityScore} | tier=${output.indexationTier} | $${(output.totalCostUsd ?? 0).toFixed(4)}`,
    );

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
      },
    });

    return {
      id: test.id,
      status: "PASS",
      contentType: test.contentType,
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
  console.log("║  POST-FIX Quality Loop Test — viser tier_2 (score ≥ 60)      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const results = [];
  for (const t of TESTS) {
    results.push(await runOne(t));
  }

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                       SUMMARY                                  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  const pass = results.filter((r: any) => r.status === "PASS");
  const tier1 = pass.filter((r: any) => r.indexationTier === "tier_1_indexable");
  const tier2 = pass.filter((r: any) => r.indexationTier === "tier_2_noindex_follow");
  const tier3 = pass.filter((r: any) => r.indexationTier === "tier_3_noindex_nofollow");
  const totalCost = pass.reduce((s: number, r: any) => s + (r.costUsd ?? 0), 0);
  const avgScore =
    pass.length > 0
      ? Math.round(pass.reduce((s: number, r: any) => s + (r.qualityScore ?? 0), 0) / pass.length)
      : 0;
  const avgWords =
    pass.length > 0
      ? Math.round(pass.reduce((s: number, r: any) => s + (r.wordCount ?? 0), 0) / pass.length)
      : 0;

  console.log(`Generated : ${pass.length}/${results.length}`);
  console.log(`Tier 1 indexable : ${tier1.length}`);
  console.log(`Tier 2 noindex follow : ${tier2.length}`);
  console.log(`Tier 3 noindex nofollow : ${tier3.length}`);
  console.log(`Avg quality score : ${avgScore}/100`);
  console.log(`Avg word count : ${avgWords}`);
  console.log(`Total cost : $${totalCost.toFixed(4)}`);

  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : "✗";
    console.log(
      `  ${icon} ${r.id} | ${r.contentType} | ${
        r.status === "PASS"
          ? `score=${(r as any).qualityScore} tier=${(r as any).indexationTier} ${(r as any).wordCount}w cost=$${(r as any).costUsd?.toFixed(4)}`
          : `err: ${(r as any).error?.slice(0, 80)}`
      }`,
    );
  }

  const fs = await import("node:fs/promises");
  await fs.writeFile(
    "_AUDIT/SPRINT-V7-RUNTIME-2026-05-23/quality-loop-results.json",
    JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
  );

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
