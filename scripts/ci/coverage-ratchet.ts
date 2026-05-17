#!/usr/bin/env tsx
/**
 * Coverage ratchet — fail si coverage descend sous la baseline,
 * bump auto la baseline si coverage monte.
 *
 * Sprint Phase 8.bis Point 1 — runbook deploy recovery 2026-05-17.
 *
 * Usage en CI (après `pnpm test:coverage`) :
 *   pnpm exec tsx scripts/ci/coverage-ratchet.ts [--update]
 *
 * - sans --update : compare coverage actuelle vs baseline. Si pire → exit 1.
 * - avec --update : si meilleure → écrit nouvelle baseline (commit + push
 *                   séparé recommandé).
 *
 * Lit `coverage/coverage-summary.json` (généré par v8 reporter +
 * `--coverage.reporter=json-summary` à activer dans vitest.config.ts).
 * Baseline stockée dans `.coverage-baseline.json`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface CoverageSummary {
  total: {
    statements: { pct: number };
    branches: { pct: number };
    functions: { pct: number };
    lines: { pct: number };
  };
}

interface Baseline {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  updated_at: string;
  notes: string;
}

const SUMMARY_PATH = resolve(process.cwd(), "coverage/coverage-summary.json");
const BASELINE_PATH = resolve(process.cwd(), ".coverage-baseline.json");
const UPDATE_MODE = process.argv.includes("--update");
const TOLERANCE = 0.5;

function readBaseline(): Baseline | null {
  if (!existsSync(BASELINE_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as Baseline;
}

function readSummary(): CoverageSummary {
  if (!existsSync(SUMMARY_PATH)) {
    console.error(
      `❌ ${SUMMARY_PATH} introuvable. Lancer 'pnpm test:coverage' avec reporter json-summary actif.`,
    );
    process.exit(2);
  }
  return JSON.parse(readFileSync(SUMMARY_PATH, "utf-8")) as CoverageSummary;
}

function main(): void {
  const summary = readSummary();
  const current = {
    statements: summary.total.statements.pct,
    branches: summary.total.branches.pct,
    functions: summary.total.functions.pct,
    lines: summary.total.lines.pct,
  };
  console.log("Coverage actuelle :", current);

  const baseline = readBaseline();
  if (!baseline) {
    console.warn("ℹ️  Aucune baseline trouvée — création initiale (.coverage-baseline.json).");
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          ...current,
          updated_at: new Date().toISOString(),
          notes: "Baseline initiale (Phase 8.bis Point 1 — coverage ratchet).",
        },
        null,
        2,
      ),
    );
    return;
  }

  const metrics: (keyof typeof current)[] = ["statements", "branches", "functions", "lines"];
  const regressions: string[] = [];
  const improvements: string[] = [];

  for (const m of metrics) {
    const diff = current[m] - baseline[m];
    if (diff < -TOLERANCE) {
      regressions.push(
        `${m}: ${baseline[m].toFixed(2)}% → ${current[m].toFixed(2)}% (Δ ${diff.toFixed(2)})`,
      );
    } else if (diff > TOLERANCE) {
      improvements.push(
        `${m}: ${baseline[m].toFixed(2)}% → ${current[m].toFixed(2)}% (Δ +${diff.toFixed(2)})`,
      );
    }
  }

  if (regressions.length > 0) {
    console.error("❌ Coverage REGRESSION détectée vs baseline :");
    for (const r of regressions) console.error(`  - ${r}`);
    console.error(`\nTolérance : ${TOLERANCE} point. Baseline date : ${baseline.updated_at}`);
    console.error(
      "Fix : ajouter des tests sur les modules récemment touchés ou justifier la baisse via PR description.",
    );
    process.exit(1);
  }

  if (improvements.length > 0) {
    console.log("📈 Coverage IMPROVEMENT vs baseline :");
    for (const i of improvements) console.log(`  + ${i}`);
    if (UPDATE_MODE) {
      writeFileSync(
        BASELINE_PATH,
        JSON.stringify(
          {
            ...current,
            updated_at: new Date().toISOString(),
            notes: `Baseline bumped via ratchet (${improvements.length} metrics improved).`,
          },
          null,
          2,
        ),
      );
      console.log("✓ Baseline mise à jour (.coverage-baseline.json)");
    } else {
      console.log("ℹ️  Lancer avec --update pour bumper la baseline (commit séparé recommandé).");
    }
  } else {
    console.log("✅ Coverage stable vs baseline (tolérance ±0.5 pt).");
  }
}

main();
