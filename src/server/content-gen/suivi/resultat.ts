/**
 * Construction d'une ligne `ContenuResultat` (conception § 7.2). Module PUR.
 *
 * - Toute mesure absente reste `null`, JAMAIS 0 : « indisponible » ≠ « zéro » (pilotage, principe 4).
 * - Sous les planchers du pilotage (PLAN § 4.2), la ligne porte `donneesInsuffisantes: true` et
 *   l'écran affiche « données insuffisantes » : aucune décision n'en est tirée.
 */
import { indexationMesurable, type CodeEcheance } from "./echeances";

/** ≥ 300 impressions sur 28 j pour attribuer un effet à une page (PLAN § 4.2). */
export const PLANCHER_ATTRIBUTION = 300;
/** Plancher de bruit d'une lecture courte (J3, J7) : ≥ 30 impressions (PLAN § 4.2). */
export const PLANCHER_BRUIT = 30;

export interface MesureGsc {
  readonly impressions: number;
  readonly clics: number;
  /** `position × impressions`, cumulé (stockage de `gsc_page_jours`). */
  readonly positionSum: number;
  /** Nombre de jours pour lesquels Search Console a répondu dans la fenêtre. */
  readonly joursAvecDonnees: number;
}

export interface EntreeResultat {
  readonly code: CodeEcheance;
  readonly publieLe: Date;
  readonly gsc: MesureGsc | null;
  readonly inspection: { readonly verdict: string | null; readonly inspecteLe: Date } | null;
  readonly rendezVous: number | null;
  readonly visitesIa?: number | null;
  readonly citationsIa?: number | null;
  readonly affichagesIa?: number | null;
}

export interface LigneResultat {
  readonly indexe: boolean | null;
  readonly affichages: number | null;
  readonly clics: number | null;
  readonly position: number | null;
  readonly affichagesIa: number | null;
  readonly citationsIa: number | null;
  readonly visitesIa: number | null;
  readonly rendezVous: number | null;
  readonly details: Readonly<Record<string, unknown>>;
}

export function plancherDe(code: CodeEcheance): number {
  return code === "j28" || code === "j90" ? PLANCHER_ATTRIBUTION : PLANCHER_BRUIT;
}

export function construireResultat(e: EntreeResultat): LigneResultat {
  const gsc = e.gsc && e.gsc.joursAvecDonnees > 0 ? e.gsc : null;
  const plancher = plancherDe(e.code);
  const indexeMesurable = indexationMesurable(e.code, e.publieLe, e.inspection?.inspecteLe ?? null);
  const verdict = e.inspection?.verdict ?? null;
  return {
    indexe: indexeMesurable && verdict !== null ? verdict.toUpperCase() === "PASS" : null,
    affichages: gsc ? gsc.impressions : null,
    clics: gsc ? gsc.clics : null,
    position:
      gsc && gsc.impressions > 0 ? Math.round((gsc.positionSum / gsc.impressions) * 10) / 10 : null,
    affichagesIa: e.affichagesIa ?? null,
    citationsIa: e.citationsIa ?? null,
    visitesIa: e.visitesIa ?? null,
    rendezVous: e.rendezVous,
    details: {
      source: "gsc+inspection",
      joursAvecDonnees: gsc?.joursAvecDonnees ?? 0,
      plancher,
      donneesInsuffisantes: !gsc || gsc.impressions < plancher,
      attribution: "dernier article lu (partielle, jamais « causé par »)",
      ...(verdict !== null ? { verdictInspection: verdict } : {}),
    },
  };
}
