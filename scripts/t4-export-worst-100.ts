/**
 * t4-export-worst-100.ts — Audit Will 2026-05-28.
 *
 * Lit `_AUDIT/VILLES-T4-PROGRESS/low-quality-villes.json` (généré par
 * t4-find-low-quality.ts), prend les N pires villes, et les enrichit avec
 * le contexte structurel réel (nameFr, departement, region, population)
 * depuis VILLES pour donner aux sub-agents une base factuelle fiable.
 *
 * Output : `_AUDIT/VILLES-T4-PROGRESS/worst-100-context.json`
 */
import { promises as fs } from "fs";
import path from "path";
import { VILLES } from "../src/content/villes";
import { REGIONS } from "../src/content/regions";

const N = Number(process.argv[2] ?? 100);
const LOW_QUALITY = path.join(process.cwd(), "_AUDIT", "VILLES-T4-PROGRESS", "low-quality-villes.json");
const OUTPUT = path.join(process.cwd(), "_AUDIT", "VILLES-T4-PROGRESS", `worst-${N}-context.json`);

async function main() {
  const raw = JSON.parse(await fs.readFile(LOW_QUALITY, "utf-8"));
  const problematic: Array<{ slug: string; issues: string[]; qualityScore: number | null; charsUnique: number }> =
    raw.problematic;

  const regionLabel = new Map(REGIONS.map((r) => [r.slug, r.nameFr]));
  const villeBySlug = new Map(VILLES.map((v) => [v.slug, v]));

  const worst = problematic.slice(0, N).map((p) => {
    const v = villeBySlug.get(p.slug);
    return {
      slug: p.slug,
      issues: p.issues,
      qualityScore: p.qualityScore,
      charsUnique: p.charsUnique,
      nameFr: v?.nameFr ?? p.slug,
      departement: v?.departement ?? "?",
      departementLabel: v?.departementLabel ?? v?.departement ?? "?",
      region: v?.region ?? "?",
      regionLabel: v ? (regionLabel.get(v.region) ?? v.region) : "?",
      population: v?.population ?? 0,
    };
  });

  await fs.writeFile(OUTPUT, JSON.stringify({ count: worst.length, villes: worst }, null, 2), "utf-8");
  console.log(`[export-worst] Wrote ${worst.length} villes → ${OUTPUT}`);
  // Print compact list grouped into 10
  for (let i = 0; i < worst.length; i += 10) {
    const chunk = worst.slice(i, i + 10);
    console.log(`\n--- Batch ${i / 10 + 1} (villes ${i + 1}-${i + chunk.length}) ---`);
    for (const w of chunk) {
      console.log(`  ${w.slug} | ${w.nameFr} (${w.departement} ${w.departementLabel}) | ${w.regionLabel} | pop ${w.population} | qs=${w.qualityScore} chars=${w.charsUnique}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
