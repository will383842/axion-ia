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

const RE_PAIRE = /<!--\s*apport\s*:\s*([A-D])\s*--!?>([\s\S]*?)<!--\s*\/\s*apport\s*--!?>/gi;
const RE_OUVRANT = /<!--\s*apport/i;

/**
 * Marqueurs bien formés seulement (casse et espaces tolérés). Un ouvrant trouvé À L'INTÉRIEUR
 * d'un bloc (marqueur non fermé) invalide ce bloc : il ne compte pas.
 */
export function extraireApports(html: string): ApportMarque[] {
  return [...html.matchAll(RE_PAIRE)]
    .filter((m) => !RE_OUVRANT.test(m[2] ?? ""))
    .map((m) => ({ type: (m[1] ?? "").toUpperCase() as TypeApport, html: m[2] ?? "" }));
}

/** Retire TOUT commentaire « apport » (ouvrant, fermant, orphelin, type inconnu, casse libre), en gardant le contenu. */
export function retirerMarqueursApport(html: string): string {
  return html.replace(/<!--\s*\/?\s*apport(?![a-z])[\s\S]*?--!?>/gi, "");
}

export const contientMarqueurApport = (html: string): boolean => /<!--\s*\/?\s*apport/i.test(html);

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
export function reserverApports(m: MatiereOfferte, apportsMin = 2): PlanApports {
  const positif = (n: number): boolean => Number.isFinite(n) && n > 0;
  const reserves: TypeApport[] = ["A"];
  if (positif(m.chiffresSources)) reserves.push("B");
  if (positif(m.anglesFrance)) reserves.push("C");
  if (m.donneePropre === true) reserves.push("D");
  // Générable seulement avec B ou C ET assez de types distincts pour atteindre `apportsMin`.
  if (!reserves.includes("B") && !reserves.includes("C")) {
    return {
      generable: false,
      apportsReserves: reserves,
      raison: "Aucun chiffre sourcé ni angle PME française disponible : pas assez de matière.",
    };
  }
  if (!Number.isFinite(apportsMin) || reserves.length < apportsMin) {
    return {
      generable: false,
      apportsReserves: reserves,
      raison: `${reserves.length} type(s) d'apport réservable(s), ${apportsMin} exigés.`,
    };
  }
  return { generable: true, apportsReserves: reserves, raison: null };
}
