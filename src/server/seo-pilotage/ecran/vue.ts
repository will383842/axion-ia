/**
 * Écran « Pilotage SEO & IA » : calculs de la vue d'ensemble. Module PUR (aucun accès base).
 *
 * Règle : une valeur inconnue est `null`, jamais 0. Un 0 dirait « première position » ou
 * « aucun clic » alors que la vérité est « pas de mesure ».
 */
import { positionMoyenne } from "../donnees/agregats";

export interface AgregatType {
  /** `null` : page non classée par type. Rangée sous « autre ». */
  readonly typePage: string | null;
  readonly clics: number;
  readonly impressions: number;
  readonly positionSum: number;
}

export interface LigneVue {
  /** Un type de page, ou `total`. */
  readonly typePage: string;
  readonly clics: number;
  readonly impressions: number;
  readonly position: number | null;
  /** Part des personnes qui cliquent (0 à 1). */
  readonly ctr: number | null;
  readonly variationClics: number | null;
  readonly variationImpressions: number | null;
  /** Position d'avant, pour afficher l'évolution. */
  readonly positionPrecedente: number | null;
}

/** Évolution en pourcentage. `null` si l'une des deux périodes est inconnue ou si l'avant vaut 0. */
export function variation(courant: number | null, precedent: number | null): number | null {
  if (courant === null || precedent === null) return null;
  if (!Number.isFinite(courant) || !Number.isFinite(precedent) || precedent <= 0) return null;
  return ((courant - precedent) / precedent) * 100;
}

function regrouper(agregats: ReadonlyArray<AgregatType>): Map<string, AgregatType> {
  const m = new Map<string, AgregatType>();
  for (const a of agregats) {
    const cle = a.typePage ?? "autre";
    const cur = m.get(cle);
    m.set(cle, {
      typePage: cle,
      clics: (cur?.clics ?? 0) + a.clics,
      impressions: (cur?.impressions ?? 0) + a.impressions,
      positionSum: (cur?.positionSum ?? 0) + a.positionSum,
    });
  }
  return m;
}

function ligne(typePage: string, c: AgregatType, p: AgregatType | undefined): LigneVue {
  return {
    typePage,
    clics: c.clics,
    impressions: c.impressions,
    position: positionMoyenne(c.positionSum, c.impressions),
    ctr: c.impressions > 0 ? c.clics / c.impressions : null,
    variationClics: p ? variation(c.clics, p.clics) : null,
    variationImpressions: p ? variation(c.impressions, p.impressions) : null,
    positionPrecedente: p ? positionMoyenne(p.positionSum, p.impressions) : null,
  };
}

/** Une ligne par type de page (ordre : plus d'impressions d'abord), puis le total. */
export function composerVueEnsemble(
  courant: ReadonlyArray<AgregatType>,
  precedent: ReadonlyArray<AgregatType>,
): LigneVue[] {
  const c = regrouper(courant);
  const p = regrouper(precedent);
  if (c.size === 0) return [];
  const lignes = [...c.entries()]
    .map(([t, a]) => ligne(t, a, p.get(t)))
    .sort((a, b) => b.impressions - a.impressions || a.typePage.localeCompare(b.typePage));
  const somme = (m: Map<string, AgregatType>): AgregatType | undefined =>
    m.size === 0
      ? undefined
      : {
          typePage: "total",
          clics: [...m.values()].reduce((s, a) => s + a.clics, 0),
          impressions: [...m.values()].reduce((s, a) => s + a.impressions, 0),
          positionSum: [...m.values()].reduce((s, a) => s + a.positionSum, 0),
        };
  const totalC = somme(c);
  if (!totalC) return lignes;
  return [...lignes, ligne("total", totalC, somme(p))];
}
