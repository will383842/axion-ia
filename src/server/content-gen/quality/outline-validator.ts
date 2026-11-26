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
  readonly code:
    | "multiple_h1"
    | "missing_h2"
    | "heading_level_skip"
    | "subheading_before_h2"
    // Contrôles du mode bloquant (équipe éditoriale) : jamais émis hors `bloquant`.
    | "h2_count"
    | "lone_h3"
    | "coverage_missing"
    | "coverage_duplicate"
    | "question_hors_brief"
    // Posés par `verifierPlan` (equipe/plan.ts), qui lit la réponse directe.
    | "answer_length"
    | "keyword_missing";
  readonly message: string;
}

export interface OutlineCouverture {
  /** Questions du brief. */
  readonly questions: ReadonlyArray<string>;
  /** Question couverte par chaque H2, dans l'ordre. */
  readonly h2: ReadonlyArray<string>;
  /** Questions de la FAQ. */
  readonly faq: ReadonlyArray<string>;
}

export interface OutlineOptions {
  readonly minH2?: number;
  /**
   * Mode BLOQUANT (équipe éditoriale seulement) : 5 à 8 H2, pas de H3 isolé, couverture du brief.
   * Défaut : faux = comportement d'avertissement inchangé pour tous les autres appelants.
   */
  readonly bloquant?: boolean;
  /** Contrôle de couverture ; évalué seulement en mode bloquant. */
  readonly couverture?: OutlineCouverture;
}

export interface OutlineResult {
  /** Bloquer la production ? Toujours faux hors mode `bloquant`. */
  readonly bloque?: boolean;
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

const H2_MIN_BLOQUANT = 5;
const H2_MAX_BLOQUANT = 8;

export const normaliserTitre = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function validateOutline(html: string, opts?: OutlineOptions): OutlineResult {
  const bloquant = opts?.bloquant === true;
  const minH2 = bloquant ? Math.max(opts?.minH2 ?? 0, H2_MIN_BLOQUANT) : (opts?.minH2 ?? 2);
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

  if (bloquant) {
    if (h2Count > H2_MAX_BLOQUANT) {
      issues.push({ code: "h2_count", message: `${h2Count} H2 (maximum ${H2_MAX_BLOQUANT})` });
    } else if (h2Count >= 1 && h2Count < minH2) {
      issues.push({
        code: "h2_count",
        message: `${h2Count} H2 (attendu ${minH2} à ${H2_MAX_BLOQUANT})`,
      });
    }
    // H3 seulement si un H2 en porte au moins deux.
    let h3 = 0;
    const h3ParH2: number[] = [];
    for (const lvl of levels) {
      if (lvl <= 2) {
        if (lvl === 2) h3ParH2.push((h3 = 0));
      } else if (lvl === 3 && h3ParH2.length > 0) h3ParH2[h3ParH2.length - 1] = ++h3;
    }
    if (h3ParH2.some((n) => n === 1)) {
      issues.push({
        code: "lone_h3",
        message: "H3 isolé : un H2 doit en porter au moins deux, sinon aucun",
      });
    }
    if (opts?.couverture) issues.push(...verifierCouverture(opts.couverture));
  }

  // Dédup par code (un seul message par type de défaut).
  const seen = new Set<string>();
  const deduped = issues.filter((i) => (seen.has(i.code) ? false : (seen.add(i.code), true)));
  return { valid: deduped.length === 0, issues: deduped, bloque: bloquant && deduped.length > 0 };
}

/** 100 % des questions du brief couvertes par un H2 ou la FAQ, sans répétition entre les deux. */
function verifierCouverture(c: OutlineCouverture): OutlineIssue[] {
  const issues: OutlineIssue[] = [];
  const brief = new Set(c.questions.map(normaliserTitre));
  const h2 = c.h2.map(normaliserTitre);
  const faq = c.faq.map(normaliserTitre);
  const manquantes = c.questions.filter(
    (q) => !h2.includes(normaliserTitre(q)) && !faq.includes(normaliserTitre(q)),
  );
  if (manquantes.length > 0) {
    issues.push({
      code: "coverage_missing",
      message: `question(s) du brief non couverte(s) : ${manquantes.join(" | ")}`,
    });
  }
  const doublons = [...new Set(h2.filter((q) => faq.includes(q)))];
  const repetees = [...h2, ...faq].filter(
    (q, i, tous) => tous.indexOf(q) !== i && !doublons.includes(q),
  );
  if (doublons.length > 0 || repetees.length > 0) {
    issues.push({
      code: "coverage_duplicate",
      message: `question traitée deux fois (H2/FAQ ou H2 répété) : ${[...doublons, ...repetees].join(" | ")}`,
    });
  }
  if (h2.some((q) => !brief.has(q))) {
    issues.push({
      code: "question_hors_brief",
      message: "un H2 répond à une question absente du brief",
    });
  }
  return issues;
}

/** Helper feedback : string courte pour la boucle qualité (vide si OK). */
export function outlineFeedback(html: string, opts?: OutlineOptions): string {
  const { valid, issues } = validateOutline(html, opts);
  if (valid) return "";
  return `structure de titres : ${issues.map((i) => i.message).join(" ; ")}`;
}
