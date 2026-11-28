import { estRequeteMarque } from "./intention";
import type { LigneRequete } from "./types";

/** Impressions minimales pour qu'une tranche de position compte. À calibrer sur l'historique rattrapé. */
export const MIN_IMPRESSIONS_TRANCHE = 500;
/** En dessous, le détecteur « CTR anormal » reste en veille. */
export const MIN_TRANCHES_VALIDES = 3;
/** Tranches : positions arrondies de 1 à 20. */
export const POSITION_MAX_COURBE = 20;

/**
 * Régression isotone décroissante (PAVA) : le CTR ne remonte jamais quand la
 * position se dégrade. `poids` = impressions.
 */
export function regressionIsotone(valeurs: readonly number[], poids: readonly number[]): number[] {
  const blocs: { somme: number; poids: number; n: number }[] = [];
  valeurs.forEach((v, i) => {
    const w = poids[i] ?? 1;
    blocs.push({ somme: v * w, poids: w, n: 1 });
    while (blocs.length > 1) {
      const b = blocs[blocs.length - 1]!;
      const a = blocs[blocs.length - 2]!;
      if (a.somme / a.poids >= b.somme / b.poids) break;
      blocs.splice(blocs.length - 2, 2, {
        somme: a.somme + b.somme,
        poids: a.poids + b.poids,
        n: a.n + b.n,
      });
    }
  });
  return blocs.flatMap((b) => Array<number>(b.n).fill(b.somme / b.poids));
}

export interface CourbeCtr {
  /** CTR attendu à cette position (tranche valide la plus proche) ; 0 hors du domaine mesuré. */
  ctrAttendu(position: number): number;
  readonly tranches: readonly { position: number; ctr: number; impressions: number }[];
}

/** CTR par défaut, utilisé seulement par le détecteur (a) quand le site n'a pas de courbe. */
export const CTR_REFERENCE: Readonly<Record<number, number>> = {
  1: 0.28,
  2: 0.15,
  3: 0.1,
  4: 0.07,
  5: 0.05,
  6: 0.04,
  7: 0.03,
  8: 0.025,
  9: 0.02,
  10: 0.017,
};

export function ctrReference(position: number): number {
  const p = Math.round(position);
  if (p < 1) return CTR_REFERENCE[1]!;
  return CTR_REFERENCE[p] ?? 0.01 / Math.max(1, p / 10);
}

/** Courbe du SITE, marque exclue. `null` : moins de 3 tranches valides. */
export function construireCourbeCtr(lignes: readonly LigneRequete[]): CourbeCtr | null {
  const parTranche = new Map<number, { imp: number; clics: number }>();
  for (const l of lignes) {
    if (estRequeteMarque(l.requete)) continue;
    if (
      !(l.impressions > 0) ||
      !Number.isFinite(l.position) ||
      !Number.isFinite(l.clics) ||
      l.clics < 0
    )
      continue;
    const p = Math.round(l.position);
    if (p < 1 || p > POSITION_MAX_COURBE) continue;
    const t = parTranche.get(p) ?? { imp: 0, clics: 0 };
    t.imp += l.impressions;
    t.clics += Math.min(l.clics, l.impressions);
    parTranche.set(p, t);
  }
  const valides = [...parTranche.entries()]
    .filter(([, t]) => t.imp >= MIN_IMPRESSIONS_TRANCHE)
    .sort((a, b) => a[0] - b[0]);
  if (valides.length < MIN_TRANCHES_VALIDES) return null;
  const lisses = regressionIsotone(
    valides.map(([, t]) => t.clics / t.imp),
    valides.map(([, t]) => t.imp),
  );
  const tranches = valides.map(([position, t], i) => ({
    position,
    ctr: lisses[i]!,
    impressions: t.imp,
  }));
  return {
    tranches,
    ctrAttendu(position) {
      // Hors du domaine mesuré : aucune attente (0), le détecteur reste muet.
      if (!Number.isFinite(position)) return 0;
      if (
        position < tranches[0]!.position - 0.5 ||
        position > tranches[tranches.length - 1]!.position + 0.5
      )
        return 0;
      let meilleur = tranches[0]!;
      for (const t of tranches) {
        if (Math.abs(t.position - position) < Math.abs(meilleur.position - position)) meilleur = t;
      }
      // Trou entre deux tranches : pas d'attente plutôt qu'un CTR emprunté à une position lointaine.
      if (Math.abs(meilleur.position - position) > 1) return 0;
      return meilleur.ctr;
    },
  };
}
