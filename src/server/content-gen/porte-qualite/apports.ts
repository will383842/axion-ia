/**
 * Apports originaux (§ 8) : marquage, retrait au rendu, réservation par le brief. Modules PURS.
 * Marqueur dans le texte source : `<!--apport:A-->…<!--/apport-->` (A exemple, B chiffre sourcé,
 * C angle PME française, D donnée propre). C'est un commentaire HTML : invisible à l'écran,
 * mais il DOIT être retiré avant tout rendu, JSON-LD, RSS ou export (test de B15).
 */

export type TypeApport = "A" | "B" | "C" | "D";
export const TYPES_APPORT: ReadonlyArray<TypeApport> = Object.freeze(["A", "B", "C", "D"]);

export interface ApportMarque {
  readonly type: TypeApport;
  /** Le HTML entre les marqueurs. */
  readonly html: string;
}

const RE_PAIRE = /<!--\s*apport:([A-D])\s*-->([\s\S]*?)<!--\s*\/apport\s*-->/g;

export function extraireApports(html: string): ApportMarque[] {
  return [...html.matchAll(RE_PAIRE)].map((m) => ({
    type: m[1] as TypeApport,
    html: m[2] ?? "",
  }));
}

/** Retire TOUS les marqueurs (ouvrants, fermants, orphelins) en gardant le contenu. */
export function retirerMarqueursApport(html: string): string {
  return html.replace(/<!--\s*\/?apport(?::[A-D])?\s*-->/g, "");
}

export const contientMarqueurApport = (html: string): boolean => /<!--\s*\/?apport\b/i.test(html);

export interface MatiereOfferte {
  /** Chiffres sourcés (type B) disponibles pour l'intention. */
  readonly chiffresSources: number;
  /** Angles PME française (type C) disponibles. */
  readonly anglesFrance: number;
  /** Donnée propre réelle et agrégée (type D) : `false` tant qu'aucune n'existe. */
  readonly donneePropre: boolean;
}

export interface PlanApports {
  readonly generable: boolean;
  readonly apportsReserves: ReadonlyArray<TypeApport>;
  readonly raison: string | null;
}

/**
 * Le brief réserve les apports AVANT l'écriture. Sans B ni C, l'intention reste `libre` mais
 * n'est pas générable (pas assez de matière). A (exemple type étiqueté) est toujours rédigeable.
 */
export function reserverApports(m: MatiereOfferte): PlanApports {
  const reserves: TypeApport[] = ["A"];
  if (m.chiffresSources > 0) reserves.push("B");
  if (m.anglesFrance > 0) reserves.push("C");
  if (m.donneePropre) reserves.push("D");
  if (m.chiffresSources <= 0 && m.anglesFrance <= 0) {
    return {
      generable: false,
      apportsReserves: reserves,
      raison: "Aucun chiffre sourcé ni angle PME française disponible : pas assez de matière.",
    };
  }
  return { generable: true, apportsReserves: reserves, raison: null };
}
