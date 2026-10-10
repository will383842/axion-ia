/**
 * L12 (paquet 4a, chantier « candidatures unifiées ») — les états des vidéos et
 * des liens des candidats, en LISTES FERMÉES.
 *
 * Phase « expand » : chaque écriture d'état pose DEUX colonnes, l'ancienne en
 * texte (toujours lue) et la nouvelle en enum Postgres (`etat_ferme`). Passer
 * par `etatVideo()` / `etatLien()` est ce qui garantit qu'elles disent la même
 * chose : une écriture à la main de l'une sans l'autre les ferait diverger
 * sans bruit.
 *
 * `import type` seulement : module importable partout sans tirer le client Prisma.
 */

import type { EtatLienCandidat, EtatVideoCandidat } from "../../../prisma/generated/client";

/** Cycle d'une vidéo déposée : `envoi` → `analyse` → `disponible` | `rejetee`. */
export const ETATS_VIDEO_CANDIDAT = [
  "envoi",
  "analyse",
  "disponible",
  "rejetee",
] as const satisfies readonly EtatVideoCandidat[];

/** État d'un lien au dernier passage du lundi. */
export const ETATS_LIEN_CANDIDAT = [
  "vivant",
  "mort",
  "inverifiable",
] as const satisfies readonly EtatLienCandidat[];

/** Les deux colonnes d'état d'une vidéo, identiques. */
export function etatVideo(e: EtatVideoCandidat): {
  statut: EtatVideoCandidat;
  etatFerme: EtatVideoCandidat;
} {
  return { statut: e, etatFerme: e };
}

/** Les deux colonnes d'état d'un lien, identiques. */
export function etatLien(e: EtatLienCandidat): {
  etat: EtatLienCandidat;
  etatFerme: EtatLienCandidat;
} {
  return { etat: e, etatFerme: e };
}
