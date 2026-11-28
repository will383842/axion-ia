/**
 * Délai réel avant indexation d'un article publié, d'après l'inspection d'URL (P5).
 * Module PUR. Pas de table nouvelle : le délai est dérivé des lignes `GscInspection`
 * déjà enregistrées (première inspection au verdict « PASS » moins la date de
 * publication). Précision = cadence de la rotation d'inspection : c'est une borne
 * haute du délai réel, pas une mesure à la minute.
 */

export interface ArticlePublie {
  readonly id: string;
  readonly titre: string;
  readonly chemin: string; // normalisé (minuscules, sans slash final)
  readonly publieLe: Date;
}

export interface InspectionLigne {
  readonly chemin: string;
  readonly inspecteLe: Date;
  readonly verdict: string | null;
}

export interface DelaiArticle {
  readonly id: string;
  readonly titre: string;
  readonly chemin: string;
  readonly publieLe: Date;
  /** `null` = pas encore vu indexé par une inspection. */
  readonly delaiHeures: number | null;
  readonly indexeVuLe: Date | null;
}

export const verdictIndexe = (v: string | null): boolean => v?.toUpperCase() === "PASS";

export function calculerDelais(
  articles: ReadonlyArray<ArticlePublie>,
  inspections: ReadonlyArray<InspectionLigne>,
): DelaiArticle[] {
  const parChemin = new Map<string, InspectionLigne[]>();
  for (const i of inspections) {
    const l = parChemin.get(i.chemin) ?? [];
    l.push(i);
    parChemin.set(i.chemin, l);
  }
  return articles.map((a) => {
    // Première inspection indexée à partir de la publication (une inspection
    // antérieure à la publication ne prouve rien sur ce délai).
    const vue = (parChemin.get(a.chemin) ?? [])
      .filter((i) => verdictIndexe(i.verdict) && i.inspecteLe.getTime() >= a.publieLe.getTime())
      .sort((x, y) => x.inspecteLe.getTime() - y.inspecteLe.getTime())[0];
    return {
      id: a.id,
      titre: a.titre,
      chemin: a.chemin,
      publieLe: a.publieLe,
      delaiHeures: vue
        ? Math.round(((vue.inspecteLe.getTime() - a.publieLe.getTime()) / 3_600_000) * 10) / 10
        : null,
      indexeVuLe: vue?.inspecteLe ?? null,
    };
  });
}

/** Médiane (heures) des délais connus des articles publiés dans les `jours` derniers jours. */
export function medianeDelaiHeures(
  delais: ReadonlyArray<DelaiArticle>,
  maintenant: Date,
  jours = 30,
): number | null {
  const borne = maintenant.getTime() - jours * 86_400_000;
  const v = delais
    .filter((d) => d.delaiHeures !== null && d.publieLe.getTime() >= borne)
    .map((d) => d.delaiHeures as number)
    .sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? (v[m] as number) : ((v[m - 1] as number) + (v[m] as number)) / 2;
}
