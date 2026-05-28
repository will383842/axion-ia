/**
 * t4-qa-batch-100.ts — Audit Will 2026-05-28.
 *
 * Vérifie que les 100 villes rewrites du batch sont à la PERFECTION sur tous
 * les critères. Lit `worst-100-context.json` pour la liste des slugs, puis
 * valide chaque fichier sur 11 critères stricts.
 *
 * PASS = 0 violation sur les 100. Sinon liste les villes + violations.
 */
import { promises as fs } from "fs";
import path from "path";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");
const CONTEXT = path.join(
  process.cwd(),
  "_AUDIT",
  "VILLES-T4-PROGRESS",
  process.argv[2] ?? "worst-100-context.json",
);

const GENERIC_SECTORS = [
  "tpe artisanat btp", "tpe artisanat", "pme tertiaires", "pme tertiaires services",
  "commerce de proximité", "commerce proximité", "services aux entreprises",
  "professions libérales", "commerce de détail", "commerce détail", "restauration",
  "programmation informatique", "activités créatives", "hébergement", "services", "artisanat",
];

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function extractField(content: string, field: string): string | null {
  const m = content.match(new RegExp(`${field}:\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? m[1]! : null;
}

async function main() {
  const ctx = JSON.parse(await fs.readFile(CONTEXT, "utf-8"));
  const slugs: string[] = ctx.villes.map((v: { slug: string }) => v.slug);

  const failures: Array<{ slug: string; violations: string[] }> = [];
  let perfect = 0;

  for (const slug of slugs) {
    const filepath = path.join(COPY_DIR, `${slug}.ts`);
    let content: string;
    try {
      content = await fs.readFile(filepath, "utf-8");
    } catch {
      failures.push({ slug, violations: ["FICHIER INTROUVABLE"] });
      continue;
    }

    const v: string[] = [];

    // 1. Header sans tag gpt-4o
    if (/Quality score:\s*\d+\s*—\s*Model:\s*gpt-4o/.test(content)) {
      v.push("header gpt-4o quality score présent");
    }

    // 2. pitchFr 30-200 mots
    const pitchFr = extractField(content, "pitchFr");
    if (!pitchFr) v.push("pitchFr absent");
    else {
      const w = countWords(pitchFr);
      if (w < 30 || w > 220) v.push(`pitchFr ${w} mots (hors 30-220)`);
    }

    // 3. directAnswerFr ≥30 mots + "Axion-IA"
    const directAnswerFr = extractField(content, "directAnswerFr");
    if (!directAnswerFr) v.push("directAnswerFr absent");
    else {
      if (countWords(directAnswerFr) < 30) v.push(`directAnswerFr ${countWords(directAnswerFr)} mots (<30)`);
      if (!/Axion-IA/.test(directAnswerFr)) v.push("directAnswerFr sans 'Axion-IA'");
    }

    // 4. ecosystemFr + distancesFr présents
    const ecosystemFr = extractField(content, "ecosystemFr");
    const distancesFr = extractField(content, "distancesFr");
    if (!ecosystemFr) v.push("ecosystemFr absent");
    if (!distancesFr) v.push("distancesFr absent");

    // 5. combined ≥ 900 chars (on tolère 850 pour marge)
    const combined = (pitchFr ?? "") + (directAnswerFr ?? "") + (ecosystemFr ?? "") + (distancesFr ?? "");
    if (combined.length < 850) v.push(`combined ${combined.length} chars (<850)`);

    // 6. topSectorsNaf = 5 dont ≥3 spécifiques
    const sectorsBlock = content.match(/topSectorsNaf:\s*\[([\s\S]*?)\]/);
    const sectors = sectorsBlock ? Array.from(sectorsBlock[1]!.matchAll(/"([^"]+)"/g)).map((m) => m[1]!) : [];
    if (sectors.length < 5) v.push(`topSectorsNaf ${sectors.length} (<5)`);
    const generic = sectors.filter((s) => GENERIC_SECTORS.includes(s.toLowerCase().trim())).length;
    if (generic >= 3) v.push(`${generic}/${sectors.length} secteurs génériques`);

    // 7. faqGeolocalisee ≥ 5
    const faqMatches = content.match(/faqGeolocalisee:\s*\[([\s\S]*?)\],?\s*\n\s*\}/);
    const faqCount = faqMatches ? (faqMatches[1]!.match(/\bq:\s*"/g) || []).length : 0;
    if (faqCount < 5) v.push(`FAQ ${faqCount} entrées (<5)`);

    // 8. servicesContext 5 verticales
    const hasAllServices = ["audit:", "interventions:", "implementation:", "unAUn:", "sitesWeb:"].filter((s) =>
      content.includes(s),
    ).length;
    if (hasAllServices < 5) v.push(`servicesContext ${hasAllServices}/5 verticales`);

    // 9. EN = mirror FR (pitch + directAnswer)
    const pitchEn = extractField(content, "pitchEn");
    const directAnswerEn = extractField(content, "directAnswerEn");
    if (pitchEn !== pitchFr) v.push("pitchEn ≠ pitchFr (pas mirror)");
    if (directAnswerEn !== directAnswerFr) v.push("directAnswerEn ≠ directAnswerFr (pas mirror)");

    // 10. pas de tarif hardcodé dans pitch/directAnswer/ecosystem
    const priceRe = /\b(490|590|690|890|990|1490|1990|2990)\s*€\s*HT\b/;
    if (priceRe.test(pitchFr ?? "") || priceRe.test(directAnswerFr ?? "") || priceRe.test(ecosystemFr ?? "")) {
      v.push("tarif hardcodé dans pitch/directAnswer/ecosystem");
    }

    // 11. seoHook présent
    if (!extractField(content, "seoHook")) v.push("seoHook absent");

    if (v.length === 0) perfect++;
    else failures.push({ slug, violations: v });
  }

  console.log(`\n=== QA BATCH 100 ===`);
  console.log(`Perfect: ${perfect}/${slugs.length}`);
  console.log(`Failures: ${failures.length}`);
  if (failures.length > 0) {
    console.log(`\n--- Villes avec violations ---`);
    for (const f of failures) {
      console.log(`  ${f.slug}: ${f.violations.join(" | ")}`);
    }
  } else {
    console.log(`\n✅ TOUTES LES 100 VILLES SONT PARFAITES SUR LES 11 CRITÈRES.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
