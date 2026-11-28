/**
 * Porte qualité : PLAFOND DE SÉCURITÉ du jour (Q11, conception § 10.1, § 10.5).
 *
 * Une LIMITE HAUTE, jamais un objectif : aucun quota, aucun minimum à publier. Le plafond
 * du jour est le MINIMUM de toutes les limites connues : plafond de la porte (bas par
 * défaut), plafonds existants (`MAX_PUBLISH_PER_DAY`, `daily_generation_cap`…), capacité de
 * relecture humaine et capacité de coût (budget du jour / coût par contenu). La rampe
 * 150/300/1 000 est donc neutralisée tant que Will n'a pas relevé le plafond de la porte.
 * Module pur. Une valeur illisible ne relève jamais le plafond : elle est ignorée, et
 * pour le plafond de la porte lui-même elle ramène au défaut bas.
 */

/** Clé `ContentGenConfig`. */
export const CLE_PLAFOND_SECURITE = "porte_plafond_securite";
/** Plafond de départ (phase d'observation puis démarrage prudent) : une limite, pas une cible. */
export const PLAFOND_SECURITE_PAR_DEFAUT = 3;

export interface ReglagePlafond {
  readonly plafondJour: number;
  readonly capaciteRelectureJour: number | null;
  readonly budgetJourUsd: number | null;
  readonly coutParContenuUsd: number | null;
}

const entierPositifOuNul = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
const positif = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

export function reglagePlafondDepuisConfig(brut: unknown): ReglagePlafond {
  const o =
    typeof brut === "object" && brut !== null && !Array.isArray(brut)
      ? (brut as Record<string, unknown>)
      : {};
  return {
    // Absent = défaut bas. Présent mais illisible = 0 (pause) : échec fermé, jamais un relèvement.
    plafondJour:
      o.plafondJour === undefined || o.plafondJour === null
        ? PLAFOND_SECURITE_PAR_DEFAUT
        : (entierPositifOuNul(o.plafondJour) ?? 0),
    capaciteRelectureJour: entierPositifOuNul(o.capaciteRelectureJour),
    budgetJourUsd: positif(o.budgetJourUsd),
    coutParContenuUsd: positif(o.coutParContenuUsd),
  };
}

export interface DetailPlafond {
  readonly plafond: number;
  /** Quelle limite est la plus basse (pour l'écran et le journal). */
  readonly limitant: "porte" | "relecture" | "cout" | "existant";
}

/**
 * `plafondsExistants` : limites déjà en vigueur ailleurs (`null` ou ≤ 0 = pas de limite
 * lisible, ignorée : un plafond existant à 0 de config signifie « non réglé »).
 */
export function calculerPlafondSecurite(
  reglage: ReglagePlafond,
  plafondsExistants: ReadonlyArray<number | null | undefined>,
): DetailPlafond {
  let meilleur: DetailPlafond = { plafond: reglage.plafondJour, limitant: "porte" };
  const essayer = (valeur: number | null, limitant: DetailPlafond["limitant"]) => {
    if (valeur !== null && valeur < meilleur.plafond) meilleur = { plafond: valeur, limitant };
  };
  essayer(reglage.capaciteRelectureJour, "relecture");
  if (reglage.budgetJourUsd !== null && reglage.coutParContenuUsd !== null) {
    essayer(Math.floor(reglage.budgetJourUsd / reglage.coutParContenuUsd), "cout");
  }
  for (const p of plafondsExistants) {
    if (typeof p === "number" && Number.isFinite(p) && p > 0) essayer(Math.floor(p), "existant");
  }
  return meilleur;
}

/** `daily_generation_cap` est `{ maxPerDay: N }` (anti-burst) ; un nombre nu est aussi accepté. Sinon : ignoré. */
export function plafondDepuisCapGeneration(brut: unknown): number | null {
  const v =
    typeof brut === "object" && brut !== null ? (brut as { maxPerDay?: unknown }).maxPerDay : brut;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
}
