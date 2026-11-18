/**
 * Gate D — l'HORLOGE du scénario visio (`gate-d-chaine-visio.ts`).
 *
 * 🔴 Incident du 2026-11-05 : la chaîne datait son rendez-vous en dur
 * (`2026-10-06T08:00Z`, fin de session à 08:10Z). La clôture pose
 * `audioAPurgerAvant = fin + CONSERVATION_AUDIO_MAX_JOURS` (30 jours), et le
 * balayage compare cette échéance au `now()` de POSTGRES — une horloge que le
 * scénario n'injecte pas. Le 2026-11-05 à 08:10Z, l'échéance est tombée : le
 * balayage a programmé `purger_audio` dès le premier tour, le son a été effacé
 * avant la validation, et l'étape « Visio — comportements sur base réelle » a
 * rendu `R2 : 0 objet(s) au lieu de 4` sur TOUS les runs suivants (pas de
 * l'instabilité : une bombe à retardement, relancer ne pouvait rien).
 *
 * Le scénario est donc ancré sur l'heure courante, avec les MÊMES écarts
 * qu'avant (le rendez-vous a eu lieu « hier », la dictée une heure après, le
 * 2ᵉ rendez-vous quatorze jours après) : l'échéance de purge est toujours
 * ≈ 29 jours dans le futur, quel que soit le jour où la CI tourne.
 *
 * Module pur (aucune base, aucun import du site) : testé par
 * `tests/unit/ci/la-chaine-visio-ne-date-pas-son-scenario-en-dur.spec.ts`.
 */

const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;

/** Écart entre le début du rendez-vous semé et l'heure du run. */
export const RECUL_DU_SCENARIO_MS = JOUR_MS;

/**
 * Le début du rendez-vous semé : la veille, à l'heure pleine (UTC). Arrondi
 * à l'heure pour garder des horodatages lisibles dans les journaux, comme
 * l'ancienne date fixe (`…T08:00:00Z`).
 */
export function ancreDuScenario(maintenant: Date = new Date()): Date {
  const heurePleine = Math.floor(maintenant.getTime() / HEURE_MS) * HEURE_MS;
  return new Date(heurePleine - RECUL_DU_SCENARIO_MS);
}

/** `ancre` décalée de `ms` millisecondes (écarts du scénario, jamais une date absolue). */
export function apresAncre(ancre: Date, ms: number): Date {
  return new Date(ancre.getTime() + ms);
}

export const ECARTS_DU_SCENARIO = {
  /** La dictée est faite une heure après l'appel. */
  dictee: HEURE_MS,
  /** Le 2ᵉ rendez-vous, deux semaines après le premier. */
  secondRendezVous: 14 * JOUR_MS,
} as const;
