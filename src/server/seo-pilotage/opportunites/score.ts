import type { Action } from "./types";

/** Effort par action (PLAN § 4.4). */
export const EFFORT: Readonly<Record<Action, number>> = {
  titre_meta: 1,
  lien_interne: 1,
  inspection: 1,
  faq: 2,
  mise_a_jour: 3,
  nouvelle_page: 5,
};

/** priorité = gain de clics estimé × confiance / effort. Gain ≥ 0, confiance dans [0, 1]. */
export function calculerPriorite(gainClics: number, confiance: number, action: Action): number {
  const gain = Number.isFinite(gainClics) ? Math.max(0, gainClics) : 0;
  const conf = Number.isFinite(confiance) ? Math.min(1, Math.max(0, confiance)) : 0;
  return (gain * conf) / EFFORT[action];
}

/** Tri décroissant, stable : à priorité égale, URL puis requête par ordre alphabétique. */
export function classer<T extends { priorite: number; url: string; requete?: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      b.priorite - a.priorite ||
      a.url.localeCompare(b.url) ||
      (a.requete ?? "").localeCompare(b.requete ?? ""),
  );
}
