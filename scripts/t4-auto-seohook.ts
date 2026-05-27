/**
 * t4-auto-seohook.ts — Audit Will 2026-05-27.
 *
 * Génère automatiquement un champ `seoHook` (20-40 chars, sectoriel) pour
 * chaque VilleCopy qui n'en a pas, en extrayant les 2-3 premiers secteurs
 * de `topSectorsNaf` et en les normalisant (lowercase, retrait des
 * sufixes "& services", "AOC", etc.).
 *
 * But : ~2120 villes T3/T4 obtiennent un `<title>` SEO différencié au lieu
 * du fallback générique "Axion-IA · Architectes IA seniors".
 *
 * Exemples de hooks générés :
 *   topSectorsNaf: ["Tourisme pèlerin Compostelle", "Artisanat dentelle du Puy", ...]
 *   → seoHook: "tourisme pèlerin & dentelle"
 *
 *   topSectorsNaf: ["Aéronautique et forges spéciales", "Métallurgie alliages", ...]
 *   → seoHook: "aéronautique & métallurgie"
 *
 * Si topSectorsNaf manque ou trop générique, skip (laisse le fallback générique).
 */
import { promises as fs } from "fs";
import path from "path";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");

/**
 * Normalise un secteur NAF en un mot/expression compact pour seoHook.
 * - Lowercase
 * - Retire les suffixes ("AOC", "AOP", "(sous-préfecture)", etc.)
 * - Retire les mots vides ("et", "&", "de", "du", "des", "la", "le")
 * - Tronque à 2-3 mots significatifs
 */
function compactSector(sector: string): string {
  let s = sector.trim().toLowerCase();
  // Retire parenthèses + contenu
  s = s.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  // Retire suffixes acronymes/sigles
  s = s.replace(/\b(aoc|aop|igp|sas|pme|tpe|eti|sa|sarl|btp)\b/gi, "").trim();
  // Retire "et services", "et tourisme"
  s = s.replace(/\s+et\s+(services|tourisme|commerce|industrie)$/gi, "").trim();
  // Espaces multiples
  s = s.replace(/\s+/g, " ");
  // Tronque à 2 mots significatifs
  const words = s.split(" ").filter((w) => w.length >= 3);
  return words.slice(0, 2).join(" ").trim();
}

/**
 * Détecte si un secteur est trop générique pour mériter un hook.
 */
function isGenericSector(sector: string): boolean {
  const generic = [
    "tpe artisanat btp",
    "tpe artisanat",
    "pme tertiaires",
    "pme tertiaires services",
    "commerce de proximité",
    "commerce proximité",
    "services aux entreprises",
    "professions libérales",
    "commerce",
    "services",
    "artisanat",
  ];
  const normalized = sector.toLowerCase().trim();
  return generic.includes(normalized);
}

/**
 * Construit le seoHook à partir des topSectorsNaf.
 * Stratégie : prend les 2 premiers secteurs non-génériques, les compacte.
 */
function buildSeoHook(topSectorsNaf: ReadonlyArray<string>): string | null {
  const specific = topSectorsNaf.filter((s) => !isGenericSector(s));
  if (specific.length === 0) return null;

  const compact = specific
    .slice(0, 2)
    .map(compactSector)
    .filter((s) => s.length >= 3);

  if (compact.length === 0) return null;
  const hook = compact.join(" & ");

  // Sécurité : 15-40 chars
  if (hook.length < 12 || hook.length > 45) return null;

  return hook;
}

async function main() {
  const files = (await fs.readdir(COPY_DIR)).filter(
    (f) =>
      f.endsWith(".ts") &&
      !["types.ts", "_auto-generated-index.ts", "index.ts", "resolve-with-copy.ts"].includes(f),
  );

  let updated = 0;
  let skippedAlreadyHas = 0;
  let skippedNoData = 0;
  let skippedGeneric = 0;

  for (const file of files) {
    const filepath = path.join(COPY_DIR, file);
    let content = await fs.readFile(filepath, "utf-8");

    // Skip si seoHook déjà présent
    if (/seoHook:\s*"/.test(content)) {
      skippedAlreadyHas++;
      continue;
    }

    // Extract topSectorsNaf (matching le pattern multi-ligne)
    const m = content.match(/topSectorsNaf:\s*\[([\s\S]*?)\]/);
    if (!m) {
      skippedNoData++;
      continue;
    }
    const sectorsRaw = m[1]!;
    const sectors = Array.from(sectorsRaw.matchAll(/"([^"]+)"/g)).map((mm) => mm[1]!);

    if (sectors.length < 2) {
      skippedNoData++;
      continue;
    }

    const hook = buildSeoHook(sectors);
    if (!hook) {
      skippedGeneric++;
      continue;
    }

    // Insérer seoHook après directAnswerEn (ou directAnswerFr s'il manque En)
    // Position conventionnelle : après le bloc directAnswer.
    const insertPattern = /(directAnswerEn:\s*\n?\s*"[^"]+",?\s*\n)/;
    if (!insertPattern.test(content)) {
      // Fallback : insérer après ecosystemFr ou pitchEn
      const fallbackPattern = /(pitchEn:\s*\n?\s*"[^"]+",?\s*\n)/;
      if (!fallbackPattern.test(content)) {
        skippedNoData++;
        continue;
      }
      content = content.replace(fallbackPattern, `$1  seoHook: "${hook}",\n`);
    } else {
      content = content.replace(insertPattern, `$1  seoHook: "${hook}",\n`);
    }

    await fs.writeFile(filepath, content, "utf-8");
    updated++;
  }

  console.log(`[auto-seohook] Updated: ${updated}`);
  console.log(`[auto-seohook] Skipped (already has): ${skippedAlreadyHas}`);
  console.log(`[auto-seohook] Skipped (no data): ${skippedNoData}`);
  console.log(`[auto-seohook] Skipped (too generic): ${skippedGeneric}`);
  console.log(`[auto-seohook] Total files: ${files.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
