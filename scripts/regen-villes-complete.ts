#!/usr/bin/env tsx
/**
 * Orchestrator — Pipeline COMPLET LLM end-to-end pour rendre indexables les
 * 2000+ villes françaises sans copy TS hand-crafted.
 *
 * Pour chaque ville sélectionnée :
 *   1. Skip si `copy` TS existe (resolveur priorise TS — voir resolve-with-copy.ts)
 *   2. Skip si row `GeneratedVilleCopy` déjà `approved` (resume support)
 *   3. Generator A `landing-ville-economic-data` si pas de TS eco-data
 *   4. Generator B `ville-hub-copy` (consomme eco-data via ecoOverride)
 *   5. UPSERT DB + auto-approve si quality >= threshold
 *
 * Coût : ~$0.05/ville (Claude Sonnet × 2 LLM calls). Total 2100 villes ≈ $105.
 *
 * Usage :
 *   pnpm tsx scripts/regen-villes-complete.ts --tier=1
 *   pnpm tsx scripts/regen-villes-complete.ts --tier=2
 *   pnpm tsx scripts/regen-villes-complete.ts --tier=3 --auto-approve-threshold=65
 *   pnpm tsx scripts/regen-villes-complete.ts --villes=saint-denis,nanterre
 *   pnpm tsx scripts/regen-villes-complete.ts --tier=2 --dry-run
 */

import { PrismaClient } from "../prisma/generated/client";
import { VILLES } from "../src/content/villes";
import type { Ville } from "../src/content/villes";
import { generateVilleEconomicData } from "../src/server/content-gen/generators/landing-ville-economic-data";
import { generateVilleHubCopy } from "../src/server/content-gen/generators/ville-hub-copy";

type Tier = 1 | 2 | 3 | 4;

interface RunArgs {
  tier?: Tier;
  all: boolean;
  villesSlugs?: string[];
  resumeFrom?: string;
  dryRun: boolean;
  autoApproveThreshold: number;
}

function parseArgs(): RunArgs {
  const argv = process.argv.slice(2);
  const result: RunArgs = { all: false, dryRun: false, autoApproveThreshold: 70 };

  for (const arg of argv) {
    if (arg === "--all") result.all = true;
    else if (arg === "--dry-run") result.dryRun = true;
    else if (arg.startsWith("--tier=")) {
      const t = parseInt(arg.replace("--tier=", ""), 10);
      if (t >= 1 && t <= 4) result.tier = t as Tier;
      else {
        console.error(`[regen-complete] Invalid --tier: ${t}. Expected 1-4.`);
        process.exit(1);
      }
    } else if (arg.startsWith("--villes=")) {
      result.villesSlugs = arg
        .replace("--villes=", "")
        .split(",")
        .map((s) => s.trim().toLowerCase());
    } else if (arg.startsWith("--resume-from=")) {
      result.resumeFrom = arg.replace("--resume-from=", "").toLowerCase().trim();
    } else if (arg.startsWith("--auto-approve-threshold=")) {
      const t = parseInt(arg.replace("--auto-approve-threshold=", ""), 10);
      if (!isNaN(t) && t >= 0 && t <= 100) result.autoApproveThreshold = t;
    } else {
      console.error(`[regen-complete] Unknown arg: ${arg}`);
      process.exit(1);
    }
  }

  if (!result.all && result.tier === undefined && !result.villesSlugs?.length) {
    console.error("[regen-complete] Specify one of: --all | --tier=1-4 | --villes=slug1,slug2");
    process.exit(1);
  }
  return result;
}

function classifyTier(population: number): Tier {
  if (population >= 500_000) return 1;
  if (population >= 100_000) return 2;
  if (population >= 20_000) return 3;
  return 4;
}

function selectVilles(args: RunArgs): Ville[] {
  let pool: Ville[];
  if (args.villesSlugs?.length) {
    const slugSet = new Set(args.villesSlugs);
    pool = VILLES.filter((v) => slugSet.has(v.slug));
    const notFound = args.villesSlugs.filter((s) => !pool.some((v) => v.slug === s));
    if (notFound.length > 0) {
      console.warn(`[regen-complete] Unknown slugs: ${notFound.join(", ")}`);
    }
  } else if (args.all) {
    pool = [...VILLES];
  } else {
    pool = VILLES.filter((v) => classifyTier(v.population) === args.tier);
  }
  pool = pool.filter((v) => !v.copy); // SKIP villes avec copy TS (priorité TS)
  pool.sort((a, b) => b.population - a.population);
  if (args.resumeFrom) {
    const idx = pool.findIndex((v) => v.slug === args.resumeFrom);
    if (idx >= 0) pool = pool.slice(idx);
  }
  return pool;
}

interface VilleResult {
  villeSlug: string;
  status:
    | "skipped_already_approved"
    | "skipped_dry_run"
    | "success"
    | "failed_quality"
    | "failed_error";
  ecoGenerated: boolean;
  qualityScore?: number;
  totalCostUsd: number;
  errorMessage?: string;
}

async function processOneVille(
  prisma: PrismaClient,
  ville: Ville,
  args: RunArgs,
): Promise<VilleResult> {
  const slug = ville.slug;

  if (args.dryRun) {
    return { villeSlug: slug, status: "skipped_dry_run", ecoGenerated: false, totalCostUsd: 0 };
  }

  // Resume support : skip si déjà approved
  const existing = await prisma.generatedVilleCopy.findUnique({
    where: { villeSlug: slug },
    select: { status: true, qualityScore: true },
  });
  if (existing?.status === "approved") {
    return {
      villeSlug: slug,
      status: "skipped_already_approved",
      ecoGenerated: false,
      totalCostUsd: 0,
      qualityScore: existing.qualityScore ?? undefined,
    };
  }

  let totalCostUsd = 0;
  let ecoGenerated = false;

  // Step 1 : eco-data via generator A si absente
  let ecoOverride = ville.economicData;
  if (!ecoOverride) {
    const ecoResult = await generateVilleEconomicData({
      villeSlug: slug,
      nameFr: ville.nameFr,
      regionFr: ville.region,
      departmentFr: ville.departementLabel ?? ville.departement,
      population: ville.population,
      inseeCode: ville.inseeCode,
    });
    if (!ecoResult) {
      return {
        villeSlug: slug,
        status: "failed_error",
        ecoGenerated: false,
        totalCostUsd,
        errorMessage: "generator A returned null",
      };
    }
    totalCostUsd += ecoResult.totalCostUsd;
    ecoOverride = ecoResult.data;
    ecoGenerated = true;
  }

  // Step 2 : copy via generator B
  const copyResult = await generateVilleHubCopy({
    villeSlug: slug,
    ecoOverride,
  });
  totalCostUsd += copyResult.totalCostUsd;

  // Step 3 : auto-approve si quality OK
  if (copyResult.qualityScore >= args.autoApproveThreshold) {
    await prisma.generatedVilleCopy.update({
      where: { villeSlug: slug },
      data: {
        status: "approved",
        reviewedBy: `auto:regen-complete:>=${args.autoApproveThreshold}`,
        reviewedAt: new Date(),
        reviewNotes: `Auto-approved (score ${copyResult.qualityScore} >= ${args.autoApproveThreshold}) — regen-villes-complete.ts`,
      },
    });
    return {
      villeSlug: slug,
      status: "success",
      ecoGenerated,
      qualityScore: copyResult.qualityScore,
      totalCostUsd,
    };
  }

  return {
    villeSlug: slug,
    status: "failed_quality",
    ecoGenerated,
    qualityScore: copyResult.qualityScore,
    totalCostUsd,
    errorMessage: `quality ${copyResult.qualityScore} < threshold ${args.autoApproveThreshold} (status=generated, manual review needed)`,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const prisma = new PrismaClient();

  const villes = selectVilles(args);
  console.log(`\n[regen-complete] Selected ${villes.length} ville(s). dry-run=${args.dryRun}`);
  console.log(`[regen-complete] auto-approve threshold=${args.autoApproveThreshold}/100\n`);

  const results: VilleResult[] = [];
  const t0 = Date.now();

  for (let i = 0; i < villes.length; i++) {
    const v = villes[i]!;
    const idx = `${i + 1}/${villes.length}`;
    console.log(`[regen-complete] ${idx} ${v.slug} (pop ${v.population.toLocaleString("fr")})…`);
    try {
      const r = await processOneVille(prisma, v, args);
      results.push(r);
      const tag =
        r.status === "success"
          ? `✅ score ${r.qualityScore}`
          : r.status === "skipped_already_approved"
            ? `⏭️  already approved (score ${r.qualityScore ?? "?"})`
            : r.status === "skipped_dry_run"
              ? "🔍 dry-run"
              : `❌ ${r.status} — ${r.errorMessage ?? ""}`;
      console.log(`           → ${tag} ($${r.totalCostUsd.toFixed(4)})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`           → ❌ EXCEPTION: ${msg}`);
      results.push({
        villeSlug: v.slug,
        status: "failed_error",
        ecoGenerated: false,
        totalCostUsd: 0,
        errorMessage: msg,
      });
    }
  }

  const durationMin = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  const totalCost = results.reduce((s, r) => s + r.totalCostUsd, 0);
  const success = results.filter((r) => r.status === "success").length;
  const skipped = results.filter((r) => r.status.startsWith("skipped")).length;
  const failed = results.filter((r) => r.status.startsWith("failed")).length;

  console.log(`\n[regen-complete] ==================== SUMMARY ====================`);
  console.log(`  Total villes processed : ${results.length}`);
  console.log(`  Success (approved)     : ${success}`);
  console.log(`  Skipped                : ${skipped}`);
  console.log(`  Failed                 : ${failed}`);
  console.log(`  Total cost (USD)       : $${totalCost.toFixed(4)}`);
  console.log(`  Duration (min)         : ${durationMin}`);
  console.log(`  ====================================================\n`);

  if (failed > 0) {
    console.log(`[regen-complete] Failed villes (manual review):`);
    results
      .filter((r) => r.status.startsWith("failed"))
      .forEach((r) => console.log(`  - ${r.villeSlug} : ${r.status} (${r.errorMessage ?? ""})`));
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\n[regen-complete] FATAL:", err);
  process.exit(2);
});
