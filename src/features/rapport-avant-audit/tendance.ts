/**
 * Tendance d'une entreprise d'après ses exercices publiés (2026-11-02) — module PUR.
 *
 * Calculée par du CODE, jamais par l'IA : l'IA relève les chiffres et leurs sources, ce module en
 * tire la tendance, de la même façon pour tous les clients.
 *
 * Règles :
 *   · il faut au moins deux exercices avec un chiffre d'affaires, sinon « indéterminée » ;
 *   · taux de croissance annuel moyen entre le premier et le dernier exercice connus (composé,
 *     sur le nombre d'années qui les sépare, trous compris) ;
 *   · au-dessus de +3 % par an : croissance ; en dessous de −3 % : décroissance ; entre les deux :
 *     stabilité. Le seuil est écrit ici, pas dans une consigne d'IA ;
 *   · on signale toujours : années manquantes entre deux exercices, ancienneté du dernier exercice.
 */

export type Tendance = "croissance" | "stabilite" | "decroissance" | "indeterminee";

export interface ExerciceChiffre {
  readonly annee: number;
  readonly chiffreAffairesEur: number | null;
}

export interface LectureTendance {
  readonly tendance: Tendance;
  /** Taux annuel moyen en %, arrondi à 0,1 ; `null` si indéterminée. */
  readonly tauxAnnuelMoyenPct: number | null;
  readonly premierExercice: number | null;
  readonly dernierExercice: number | null;
  /** Mises en garde à afficher telles quelles. */
  readonly limites: ReadonlyArray<string>;
}

export const SEUIL_TENDANCE_PCT = 3;
/** Au-delà de ce nombre d'années depuis le dernier exercice, la donnée est dite ancienne. */
export const ANCIENNETE_MAX_ANNEES = 2;

export function lireTendance(
  exercices: ReadonlyArray<ExerciceChiffre>,
  anneeCourante: number,
): LectureTendance {
  const avecCa = exercices
    .filter(
      (e): e is { annee: number; chiffreAffairesEur: number } =>
        e.chiffreAffairesEur !== null && Number.isFinite(e.chiffreAffairesEur),
    )
    .sort((a, b) => a.annee - b.annee);

  const limites: string[] = [];
  const dernier = avecCa.at(-1);
  if (dernier !== undefined && anneeCourante - dernier.annee > ANCIENNETE_MAX_ANNEES) {
    limites.push(
      `Dernier exercice connu : ${dernier.annee}. Les chiffres plus récents ne sont pas publiés ou n'ont pas été trouvés : la tendance décrit le passé, pas la situation actuelle.`,
    );
  }
  if (avecCa.length < 2) {
    return {
      tendance: "indeterminee",
      tauxAnnuelMoyenPct: null,
      premierExercice: avecCa[0]?.annee ?? null,
      dernierExercice: dernier?.annee ?? null,
      limites: [
        ...limites,
        "Moins de deux exercices avec un chiffre d'affaires : aucune tendance ne peut être affirmée.",
      ],
    };
  }

  const premier = avecCa[0] as { annee: number; chiffreAffairesEur: number };
  const fin = dernier as { annee: number; chiffreAffairesEur: number };
  const annees = fin.annee - premier.annee;
  if (annees > avecCa.length - 1) {
    limites.push(
      "Des exercices manquent entre le premier et le dernier : la tendance est une moyenne sur la période.",
    );
  }
  if (premier.chiffreAffairesEur <= 0) {
    return {
      tendance: "indeterminee",
      tauxAnnuelMoyenPct: null,
      premierExercice: premier.annee,
      dernierExercice: fin.annee,
      limites: [
        ...limites,
        "Le premier chiffre d'affaires est nul ou négatif : le taux n'est pas calculable.",
      ],
    };
  }

  const taux =
    (Math.pow(fin.chiffreAffairesEur / premier.chiffreAffairesEur, 1 / annees) - 1) * 100;
  const arrondi = Math.round(taux * 10) / 10;
  const tendance: Tendance =
    arrondi > SEUIL_TENDANCE_PCT
      ? "croissance"
      : arrondi < -SEUIL_TENDANCE_PCT
        ? "decroissance"
        : "stabilite";
  return {
    tendance,
    tauxAnnuelMoyenPct: arrondi,
    premierExercice: premier.annee,
    dernierExercice: fin.annee,
    limites,
  };
}
