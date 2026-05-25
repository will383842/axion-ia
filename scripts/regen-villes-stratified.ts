#!/usr/bin/env tsx
/**
 * Stratified LLM content generation for 2150 French cities.
 *
 * Usage:
 *   pnpm tsx scripts/regen-villes-stratified.ts --tier=1
 *   pnpm tsx scripts/regen-villes-stratified.ts --tier=2 --resume-from=lyon
 *   pnpm tsx scripts/regen-villes-stratified.ts --all
 *   pnpm tsx scripts/regen-villes-stratified.ts --villes=paris,lyon,bordeaux
 *   pnpm tsx scripts/regen-villes-stratified.ts --tier=1 --dry-run
 *
 * Cost estimates:
 *   Tier 1 (~100 villes × 5 verticales × 4 generators): ~$25-35
 *   Tier 2 (~400 villes × 5 verticales × 2 generators): ~$35-50
 *   Tier 3 (~1650 villes, uses existing landing-ville-shared.ts): $0 additional
 *   TOTAL: ~$60-85
 *
 * Tier mapping (cf. seed-city-generation-order.ts):
 *   T1 : > 500 000 hab.  (~4 villes : Paris, Marseille, Lyon, Toulouse)
 *   T2 : 100 000 – 500 000 (~40 villes)
 *   T3 : 20 000 – 100 000 (~400 villes)
 *   T4 : < 20 000 (~1700 villes)
 *
 * Stratégie génération :
 *   Tier 1 (T1+T2, ~100 villes) : ecosystem + secteurs + faq-extended + cas-usage (4 generators)
 *   Tier 2 (T3, ~400 villes)    : ecosystem + faq-extended (2 generators)
 *   Tier 3 (T4, ~1650 villes)   : landing-ville-shared.ts gère seul — SKIP ce script
 */

import { PrismaClient } from "../prisma/generated/client";
import { VILLES } from "../src/content/villes";
import type { Ville } from "../src/content/villes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tier = 1 | 2 | 3;

type GeneratorName = "ecosystem" | "secteurs" | "faq-extended" | "cas-usage";

interface RunArgs {
  tier?: Tier;
  all: boolean;
  villesSlugs?: string[];
  resumeFrom?: string;
  dryRun: boolean;
}

interface GeneratorResult {
  generatorName: GeneratorName;
  villeSlug: string;
  success: boolean;
  skipped: boolean;
  errorMessage?: string;
  costUsd?: number;
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(): RunArgs {
  const argv = process.argv.slice(2);
  const result: RunArgs = { all: false, dryRun: false };

  for (const arg of argv) {
    if (arg === "--all") {
      result.all = true;
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg.startsWith("--tier=")) {
      const t = parseInt(arg.replace("--tier=", ""), 10);
      if (t === 1 || t === 2 || t === 3) {
        result.tier = t as Tier;
      } else {
        console.error(`[regen-villes] Invalid --tier value: ${t}. Expected 1, 2 or 3.`);
        process.exit(1);
      }
    } else if (arg.startsWith("--resume-from=")) {
      result.resumeFrom = arg.replace("--resume-from=", "").toLowerCase().trim();
    } else if (arg.startsWith("--villes=")) {
      result.villesSlugs = arg
        .replace("--villes=", "")
        .split(",")
        .map((s) => s.trim().toLowerCase());
    } else {
      console.error(`[regen-villes] Unknown argument: ${arg}`);
      console.error(
        "Usage: pnpm tsx scripts/regen-villes-stratified.ts --tier=1|2|3 | --all | --villes=paris,lyon [--resume-from=slug] [--dry-run]",
      );
      process.exit(1);
    }
  }

  if (!result.all && result.tier === undefined && !result.villesSlugs?.length) {
    console.error("[regen-villes] You must specify at least one of: --all, --tier=N, --villes=...");
    console.error(
      "Usage: pnpm tsx scripts/regen-villes-stratified.ts --tier=1|2|3 | --all | --villes=paris,lyon [--resume-from=slug] [--dry-run]",
    );
    process.exit(1);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tier classification (mirrors seed-city-generation-order.ts)
// ---------------------------------------------------------------------------

function classifyTier(population: number): Tier {
  if (population > 500_000) return 1;
  if (population >= 100_000) return 1; // T1+T2 → strategy tier 1
  if (population >= 20_000) return 2; // T3     → strategy tier 2
  return 3; // T4     → strategy tier 3 (skip)
}

// ---------------------------------------------------------------------------
// Filter villes by tier/slug args
// ---------------------------------------------------------------------------

function selectVilles(args: RunArgs): Ville[] {
  if (args.villesSlugs?.length) {
    const slugSet = new Set(args.villesSlugs);
    const found = VILLES.filter((v) => slugSet.has(v.slug));
    const notFound = args.villesSlugs.filter((s) => !VILLES.some((v) => v.slug === s));
    if (notFound.length > 0) {
      console.warn(`[regen-villes] Warning: unknown ville slugs: ${notFound.join(", ")}`);
    }
    return [...found].sort((a, b) => b.population - a.population);
  }

  if (args.all) {
    // All tiers — tier 3 will be skipped in the generator loop
    return [...VILLES].sort((a, b) => b.population - a.population);
  }

  // Filter by explicit tier
  const targetTier = args.tier!;
  return [...VILLES]
    .filter((v) => classifyTier(v.population) === targetTier)
    .sort((a, b) => b.population - a.population);
}

// ---------------------------------------------------------------------------
// Generators for each tier
// ---------------------------------------------------------------------------

const GENERATORS_BY_TIER: Record<Tier, GeneratorName[]> = {
  1: ["ecosystem", "secteurs", "faq-extended", "cas-usage"],
  2: ["ecosystem", "faq-extended"],
  3: [], // handled by landing-ville-shared.ts — no action here
};

// ---------------------------------------------------------------------------
// Resume support: check if content for ville+generator already published
// ---------------------------------------------------------------------------

async function isAlreadyGenerated(
  prisma: PrismaClient,
  villeSlug: string,
  generatorName: GeneratorName,
): Promise<boolean> {
  // Map generator names to contentType values in ContentGenJob
  const contentTypeMap: Record<GeneratorName, string> = {
    ecosystem: "landing_ville",
    secteurs: "landing_ville",
    "faq-extended": "faq_standalone",
    "cas-usage": "case_study_local",
  };
  const contentType = contentTypeMap[generatorName];

  // templateVariant discriminates ecosystem/secteurs/faq-extended/cas-usage within landing_ville
  const variantMap: Record<GeneratorName, string | undefined> = {
    ecosystem: "ville_ecosystem",
    secteurs: "ville_secteurs",
    "faq-extended": "ville_faq_extended",
    "cas-usage": "ville_cas_usage",
  };
  const templateVariant = variantMap[generatorName];

  const existing = await prisma.contentGenJob.findFirst({
    where: {
      anchorVilleSlug: villeSlug,
      contentType: contentType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      status: "published",
      ...(templateVariant
        ? {
            inputPayload: {
              path: ["templateVariant"],
              equals: templateVariant,
            },
          }
        : {}),
    },
    select: { id: true },
  });

  return existing !== null;
}

// ---------------------------------------------------------------------------
// Dynamic imports for optional generators
// (generators may not exist yet — created by parallel Sprint A agent)
// ---------------------------------------------------------------------------

type EcosystemFn = (params: {
  ville: { nameFr: string; regionFr: string; population?: number; insee?: string };
  verticale: string;
}) => Promise<unknown>;

type SecteursFn = (params: {
  ville: { nameFr: string; regionFr: string; population?: number };
  verticale: string;
}) => Promise<unknown>;

type FaqExtendedFn = (params: {
  villeSlug: string;
  villeName: string;
  regionName: string;
  verticale: string;
}) => Promise<unknown>;

type CasUsageFn = (params: {
  villeSlug: string;
  villeName: string;
  regionName: string;
  verticale: string;
}) => Promise<unknown>;

async function importGeneratorFn(generatorName: GeneratorName): Promise<{
  fn: EcosystemFn | SecteursFn | FaqExtendedFn | CasUsageFn;
  available: boolean;
}> {
  const generatorPaths: Record<GeneratorName, string> = {
    ecosystem: "@/server/content-gen/generators/landing-ville-ecosystem",
    secteurs: "@/server/content-gen/generators/landing-ville-secteurs",
    "faq-extended": "@/server/content-gen/generators/landing-ville-faq-extended",
    "cas-usage": "@/server/content-gen/generators/landing-ville-cas-usage",
  };

  const exportNames: Record<GeneratorName, string> = {
    ecosystem: "generateVilleEcosystem",
    secteurs: "generateVilleSecteurs",
    "faq-extended": "generateVilleFaqExtended",
    "cas-usage": "generateVilleCasUsage",
  };

  try {
    const mod = await import(generatorPaths[generatorName]);
    const fn = mod[exportNames[generatorName]];
    if (typeof fn !== "function") {
      console.warn(
        `[regen-villes] Generator "${generatorName}": export "${exportNames[generatorName]}" not found in module.`,
      );
      return { fn: async () => null, available: false };
    }
    return { fn, available: true };
  } catch {
    console.warn(
      `[regen-villes] Generator "${generatorName}" module not available yet — will be skipped.`,
    );
    return { fn: async () => null, available: false };
  }
}

// ---------------------------------------------------------------------------
// Run a single generator for a single ville
// ---------------------------------------------------------------------------

async function runGenerator(
  prisma: PrismaClient,
  ville: Ville,
  generatorName: GeneratorName,
  tier: Tier,
  dryRun: boolean,
): Promise<GeneratorResult> {
  // Resume check
  if (!dryRun) {
    const alreadyDone = await isAlreadyGenerated(prisma, ville.slug, generatorName);
    if (alreadyDone) {
      return { generatorName, villeSlug: ville.slug, success: true, skipped: true };
    }
  }

  if (dryRun) {
    return { generatorName, villeSlug: ville.slug, success: true, skipped: false };
  }

  const { fn, available } = await importGeneratorFn(generatorName);
  if (!available) {
    return {
      generatorName,
      villeSlug: ville.slug,
      success: false,
      skipped: true,
      errorMessage: "Generator module not available (not yet created)",
    };
  }

  try {
    const regionFr = ville.region.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Build params based on generator name
    let params: Parameters<EcosystemFn | SecteursFn | FaqExtendedFn | CasUsageFn>[0];
    if (generatorName === "ecosystem" || generatorName === "secteurs") {
      params = {
        ville: {
          nameFr: ville.nameFr,
          regionFr,
          population: ville.population,
          insee: ville.inseeCode,
        },
        verticale: "interventions", // default verticale for standalone enrichment
      };
    } else {
      params = {
        villeSlug: ville.slug,
        villeName: ville.nameFr,
        regionName: regionFr,
        verticale: "interventions",
      };
    }

    const result = await (fn as (p: typeof params) => Promise<unknown>)(params);

    const costUsdValue = (result as { costUsd?: number } | null)?.costUsd;
    return {
      generatorName,
      villeSlug: ville.slug,
      success: result !== null,
      skipped: false,
      ...(costUsdValue !== undefined ? { costUsd: costUsdValue } : {}),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      generatorName,
      villeSlug: ville.slug,
      success: false,
      skipped: false,
      errorMessage: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Simple concurrency queue (avoids importing p-limit to keep zero extra deps)
// ---------------------------------------------------------------------------

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  const running: Promise<void>[] = [];
  let index = 0;

  while (index < tasks.length || running.length > 0) {
    while (running.length < concurrency && index < tasks.length) {
      const task = tasks[index++];
      if (!task) continue;
      const p = task().then((r) => {
        results.push(r);
        running.splice(running.indexOf(p), 1);
      });
      running.push(p);
    }
    if (running.length > 0) {
      await Promise.race(running);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();
  const prisma = new PrismaClient();

  try {
    const allVilles = selectVilles(args);

    // Apply --resume-from (skip everything before the target slug in sorted order)
    let villes = allVilles;
    if (args.resumeFrom) {
      const idx = allVilles.findIndex((v) => v.slug === args.resumeFrom);
      if (idx === -1) {
        console.warn(
          `[regen-villes] --resume-from="${args.resumeFrom}" not found — starting from beginning.`,
        );
      } else {
        villes = allVilles.slice(idx);
        console.log(
          `[regen-villes] Resuming from "${args.resumeFrom}" (skipping ${idx} villes before it).`,
        );
      }
    }

    const totalVilles = villes.length;
    console.log(`[regen-villes] Selected ${totalVilles} villes. dry-run=${args.dryRun}`);

    if (args.dryRun) {
      console.log("[regen-villes] DRY-RUN mode — no LLM calls will be made.");
    }

    // Stats
    let totalDone = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let totalCostUsd = 0;

    // Process each ville
    const CONCURRENCY = 5;
    const tasks: (() => Promise<void>)[] = [];

    let villeIndex = 0;
    for (const ville of villes) {
      villeIndex++;
      const currentVilleIndex = villeIndex;
      const villeTier: Tier = args.villesSlugs?.length
        ? // When explicit --villes list, infer tier from population
          classifyTier(ville.population)
        : // When --tier=N specified, use that tier for generator selection
          (args.tier ?? classifyTier(ville.population));

      const generatorsForThisVille = GENERATORS_BY_TIER[villeTier];

      if (generatorsForThisVille.length === 0) {
        // Tier 3 — skip
        console.log(
          `[gen-massive] ${ville.nameFr} (tier ${villeTier}, ${currentVilleIndex}/${totalVilles}) SKIP — tier 3 handled by landing-ville-shared.ts`,
        );
        totalSkipped++;
        continue;
      }

      const task = async (): Promise<void> => {
        const genResults: GeneratorResult[] = [];

        for (const generatorName of generatorsForThisVille) {
          const r = await runGenerator(prisma, ville, generatorName, villeTier, args.dryRun);
          genResults.push(r);
          if (r.costUsd) totalCostUsd += r.costUsd;
        }

        const done = genResults.filter((r) => r.success && !r.skipped);
        const skippedGen = genResults.filter((r) => r.skipped);
        const failed = genResults.filter((r) => !r.success);

        const doneLabels = done.map((r) => r.generatorName).join("+");
        const skippedLabels = skippedGen.map((r) => r.generatorName).join("+");

        if (failed.length > 0) {
          totalFailed++;
          console.error(
            `[gen-massive] ${ville.nameFr} (tier ${villeTier}, ${currentVilleIndex}/${totalVilles}) FAILED: ${failed.map((r) => `${r.generatorName}: ${r.errorMessage ?? "unknown"}`).join("; ")}`,
          );
        } else {
          totalDone++;
          const label = args.dryRun
            ? `would run: ${generatorsForThisVille.join("+")}`
            : doneLabels
              ? `done: ${doneLabels}${skippedLabels ? ` (skipped: ${skippedLabels})` : ""}`
              : `all skipped (already in DB): ${skippedLabels}`;

          console.log(
            `[gen-massive] ${ville.nameFr} (tier ${villeTier}, ${currentVilleIndex}/${totalVilles}) ${label}`,
          );
        }
      };

      tasks.push(task);
    }

    await runWithConcurrency(tasks, CONCURRENCY);

    // Summary
    console.log("\n[regen-villes] ==================== SUMMARY ====================");
    console.log(`  Total villes selected : ${totalVilles}`);
    console.log(`  Done (success)        : ${totalDone}`);
    console.log(`  Skipped               : ${totalSkipped}`);
    console.log(`  Failed                : ${totalFailed}`);
    console.log(
      `  Estimated cost (USD)  : $${totalCostUsd.toFixed(4)} ${args.dryRun ? "(dry-run: $0 actual)" : ""}`,
    );
    console.log("[regen-villes] =====================================================\n");

    if (totalFailed > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[regen-villes] Fatal error:", err);
  process.exit(1);
});
