/**
 * Ordre de priorité de la rotation d'inspection (P5). Module PUR.
 *
 *  1. pages publiées ou modifiées depuis moins de 48 h (et pas revues depuis la modification) ;
 *  2. impressions qui chutent, ou nulles depuis 14 jours (repassage au plus une fois par semaine) ;
 *  3. les 15 pages stratégiques (budget Web Vitals), chaque semaine ;
 *  4. jamais inspectées, puis les plus anciennes ;
 *  5. pages en noindex, une fois par mois.
 *
 * Au sein d'un rang : la plus anciennement inspectée d'abord (jamais = tout en tête).
 */
export interface CandidatInspection {
  /** Chemin FR normalisé (`normaliserChemin`). */
  readonly chemin: string;
  readonly modifieLe: Date | null;
  readonly derniereInspection: Date | null;
  readonly impressions14: number;
  readonly impressionsPrecedentes14: number;
  readonly noindex: boolean;
}

/** Les 15 pages stratégiques du budget Web Vitals (AGENTS.md), chemins FR normalisés. */
export const PAGES_STRATEGIQUES: ReadonlyArray<string> = [
  "/fr",
  "/fr/interventions",
  "/fr/interventions/essentielle",
  "/fr/audit",
  "/fr/audit/flash",
  "/fr/implementation",
  "/fr/cas-concrets",
  "/fr/methodologie",
  "/fr/comparaisons",
  "/fr/stack-ia",
  "/fr/implantations",
  "/fr/reserver",
  "/fr/contact",
  "/fr/appel",
  "/fr/galerie",
];

const JOUR_MS = 86_400_000;
export const FENETRE_NOUVEAUTE_MS = 48 * 3_600_000;
export const RAPPEL_CHUTE_JOURS = 7;
export const RAPPEL_STRATEGIQUE_JOURS = 7;
export const RAPPEL_NOINDEX_JOURS = 30;
/** Sous ce nombre d'impressions sur la fenêtre précédente, une « chute » n'est que du bruit. */
export const PLANCHER_CHUTE = 10;
export const SEUIL_CHUTE = 0.5;
/** Rang 4 : une page vue depuis moins d'une semaine n'est pas repassée. */
export const RAPPEL_MIN_JOURS = 7;

export type Priorite = 1 | 2 | 3 | 4 | 5;

const STRATEGIQUES: ReadonlySet<string> = new Set(PAGES_STRATEGIQUES);

function ageJours(d: Date | null, maintenant: Date): number {
  return d ? (maintenant.getTime() - d.getTime()) / JOUR_MS : Number.POSITIVE_INFINITY;
}

export function prioriteDe(c: CandidatInspection, maintenant: Date): Priorite | null {
  const age = ageJours(c.derniereInspection, maintenant);
  if (c.noindex) {
    return age >= RAPPEL_NOINDEX_JOURS ? 5 : null;
  }
  if (
    c.modifieLe &&
    maintenant.getTime() - c.modifieLe.getTime() < FENETRE_NOUVEAUTE_MS &&
    (!c.derniereInspection || c.derniereInspection.getTime() < c.modifieLe.getTime())
  ) {
    return 1;
  }
  const chute =
    c.impressions14 === 0 ||
    (c.impressionsPrecedentes14 >= PLANCHER_CHUTE &&
      c.impressions14 < c.impressionsPrecedentes14 * SEUIL_CHUTE);
  if (chute && age >= RAPPEL_CHUTE_JOURS) return 2;
  if (STRATEGIQUES.has(c.chemin) && age >= RAPPEL_STRATEGIQUE_JOURS) return 3;
  if (age >= RAPPEL_MIN_JOURS) return 4;
  return null;
}

/** Les `n` premières pages à inspecter : rang 1 → 5, puis la plus anciennement inspectée. */
export function choisirPages(
  candidats: ReadonlyArray<CandidatInspection>,
  maintenant: Date,
  n: number,
): CandidatInspection[] {
  if (!(n > 0)) return [];
  const classes: Array<{ c: CandidatInspection; p: Priorite; t: number }> = [];
  for (const c of candidats) {
    const p = prioriteDe(c, maintenant);
    if (p !== null) classes.push({ c, p, t: c.derniereInspection?.getTime() ?? 0 });
  }
  classes.sort((a, b) => a.p - b.p || a.t - b.t || (a.c.chemin < b.c.chemin ? -1 : 1));
  return classes.slice(0, Math.floor(n)).map((x) => x.c);
}
