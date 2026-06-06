/**
 * Qualiopi — Calculs indicateurs (PUR — aucune I/O).
 *
 * Toutes les fonctions de ce module sont pures : aucun appel Prisma, Redis,
 * ou autre I/O. Importables et testables sans mock.
 *
 * Formules officieuses (specs §6.3) :
 *   - Taux satisfaction  : AVG(noteGlobale)/5 × 100
 *   - Taux réussite      : count(acquis) / count(*) × 100
 *   - Taux complétion    : count(tauxPresence ≥ seuil) / count(*) × 100
 *   - Délai accès moyen  : AVG(dateDebut - createdAt) en jours
 *
 * Plausibilité : nb < 5 → fiable = false + signalement « en cours de constitution ».
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constante seuil de plausibilité
// ─────────────────────────────────────────────────────────────────────────────

/** Nombre minimal d'observations pour considérer un indicateur fiable. */
const SEUIL_FIABILITE = 5;

// ─────────────────────────────────────────────────────────────────────────────
// computeTauxSatisfaction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le taux de satisfaction à partir d'un tableau de notes (1-5).
 *
 * Formule : round(AVG(notes) / 5 × 100, 1)
 * Si notes est vide : tauxPct = 0, fiable = false.
 */
export function computeTauxSatisfaction(notes: number[]): {
  tauxPct: number;
  nb: number;
  fiable: boolean;
} {
  const nb = notes.length;
  if (nb === 0) {
    return { tauxPct: 0, nb: 0, fiable: false };
  }

  const somme = notes.reduce((acc, note) => acc + note, 0);
  const moyenne = somme / nb;
  const tauxPct = Math.round((moyenne / 5) * 100 * 10) / 10;

  return {
    tauxPct,
    nb,
    fiable: nb >= SEUIL_FIABILITE,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeTauxReussite
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le taux de réussite à partir des niveaux d'acquisition.
 *
 * Formule : round(count(acquis) / count(*) × 100, 1)
 * Si niveaux est vide : tauxPct = 0, nbValides = 0, fiable = false.
 */
export function computeTauxReussite(
  niveaux: Array<"non_acquis" | "partiellement_acquis" | "acquis">,
): {
  tauxPct: number;
  nb: number;
  nbValides: number;
  fiable: boolean;
} {
  const nb = niveaux.length;
  if (nb === 0) {
    return { tauxPct: 0, nb: 0, nbValides: 0, fiable: false };
  }

  const nbValides = niveaux.filter((n) => n === "acquis").length;
  const tauxPct = Math.round((nbValides / nb) * 100 * 10) / 10;

  return {
    tauxPct,
    nb,
    nbValides,
    fiable: nb >= SEUIL_FIABILITE,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeTauxCompletion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le taux de complétion (présence) à partir des taux de présence individuels.
 *
 * Formule : round(count(tauxPresencePct >= seuilPct) / count(*) × 100, 1)
 * Les valeurs null sont considérées comme absentes (< seuil).
 *
 * @param tauxPresences - Tableau des taux de présence par inscription (null = absent).
 * @param seuilPct      - Seuil de présence pour considérer l'inscription complète.
 */
export function computeTauxCompletion(
  tauxPresences: Array<number | null>,
  seuilPct: number,
): {
  tauxPct: number;
  nb: number;
  fiable: boolean;
} {
  const nb = tauxPresences.length;
  if (nb === 0) {
    return { tauxPct: 0, nb: 0, fiable: false };
  }

  const nbComplets = tauxPresences.filter((t): t is number => t !== null && t >= seuilPct).length;

  const tauxPct = Math.round((nbComplets / nb) * 100 * 10) / 10;

  return {
    tauxPct,
    nb,
    fiable: nb >= SEUIL_FIABILITE,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeDelaiAccesMoyen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le délai d'accès moyen en jours.
 *
 * Formule : AVG(dateDebut - createdAt) en jours entiers (arrondi à 1 décimale).
 * Si paires est vide : jours = 0.
 */
export function computeDelaiAccesMoyen(paires: Array<{ dateDebut: Date; createdAt: Date }>): {
  jours: number;
  nb: number;
} {
  const nb = paires.length;
  if (nb === 0) {
    return { jours: 0, nb: 0 };
  }

  const MS_PAR_JOUR = 1000 * 60 * 60 * 24;

  const sommejours = paires.reduce((acc, { dateDebut, createdAt }) => {
    const diff = dateDebut.getTime() - createdAt.getTime();
    return acc + diff / MS_PAR_JOUR;
  }, 0);

  const jours = Math.round((sommejours / nb) * 10) / 10;

  return { jours, nb };
}
