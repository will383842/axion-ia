/**
 * VIS-11 (audit visibilité 2026-06-05) — Validateur de hiérarchie de titres.
 *
 * Avant ce module, aucun contrôle structurel de l'outline n'existait : seul un
 * scoring SEO mou (scoreH1Unique/scoreH2Structure) et un SimHash anti-doublon.
 * Ici on détecte les vrais défauts de structure (mauvais pour l'accessibilité,
 * les featured snippets « sommaire » et la compréhension par les LLMs) :
 *  - multiple_h1        : > 1 H1 dans le body (le H1 de page prime ; le body
 *                          content-gen peut en avoir 1 — strippé au render —
 *                          mais jamais plusieurs)
 *  - missing_h2         : moins de `minH2` H2 (structure trop plate)
 *  - heading_level_skip : saut de niveau (ex. H2 → H4 sans H3)
 *  - subheading_before_h2 : un H3/H4 avant le 1er H2 (nesting cassé)
 *
 * Module PUR (aucune dépendance DB/réseau) : utilisé en feedback additif dans
 * la boucle qualité des générateurs (jamais comme blocage dur — « warn d'abord »).
 */

export interface OutlineIssue {
  readonly code: "multiple_h1" | "missing_h2" | "heading_level_skip" | "subheading_before_h2";
  readonly message: string;
}

export interface OutlineResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<OutlineIssue>;
}

/** Extrait la séquence ordonnée des niveaux de titres (1..6) du HTML. */
function extractHeadingLevels(html: string): number[] {
  const re = /<h([1-6])\b[^>]*>/gi;
  const levels: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) levels.push(parseInt(m[1]!, 10));
  return levels;
}

export function validateOutline(html: string, opts?: { minH2?: number }): OutlineResult {
  const minH2 = opts?.minH2 ?? 2;
  const levels = extractHeadingLevels(html);
  const issues: OutlineIssue[] = [];

  const h1Count = levels.filter((l) => l === 1).length;
  const h2Count = levels.filter((l) => l === 2).length;

  if (h1Count > 1) {
    issues.push({
      code: "multiple_h1",
      message: `${h1Count} H1 dans le corps (cible ≤ 1 — le H1 de page prime)`,
    });
  }
  if (h2Count < minH2) {
    issues.push({ code: "missing_h2", message: `${h2Count} H2 (minimum ${minH2})` });
  }

  // Saut de niveau : on ignore le H1 (strippé au render), on compare les
  // sous-titres entre eux. Un H2 → H4 sans H3 est un saut.
  let prev = 0;
  for (const lvl of levels) {
    if (lvl === 1) {
      prev = 0;
      continue;
    }
    if (prev !== 0 && lvl > prev + 1) {
      issues.push({
        code: "heading_level_skip",
        message: `saut de niveau H${prev} → H${lvl} (insérer un H${prev + 1})`,
      });
    }
    prev = lvl;
  }

  // H3/H4 avant le 1er H2 = nesting cassé.
  const firstH2 = levels.indexOf(2);
  const firstSub = levels.findIndex((l) => l === 3 || l === 4);
  if (firstSub !== -1 && (firstH2 === -1 || firstSub < firstH2)) {
    issues.push({ code: "subheading_before_h2", message: "H3/H4 avant le 1er H2" });
  }

  // Dédup par code (un seul message par type de défaut).
  const seen = new Set<string>();
  const deduped = issues.filter((i) => (seen.has(i.code) ? false : (seen.add(i.code), true)));
  return { valid: deduped.length === 0, issues: deduped };
}

/** Helper feedback : string courte pour la boucle qualité (vide si OK). */
export function outlineFeedback(html: string, opts?: { minH2?: number }): string {
  const { valid, issues } = validateOutline(html, opts);
  if (valid) return "";
  return `structure de titres : ${issues.map((i) => i.message).join(" ; ")}`;
}
