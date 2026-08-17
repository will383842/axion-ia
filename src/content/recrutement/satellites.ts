// Lieux des villes T1+T2 (population ≥ 100 000) pour le JobPosting MULTI-LIEUX
// de la page France indexée : Google for Jobs fait remonter l'offre pour chaque
// ville (et ses alentours par proximité) depuis une seule page — sans exposer
// des pages ville quasi-dupliquées (anti-doorway). Décision Will 2026-06-08.

import { VILLES_CORE, type VilleData } from "@/content/villes/core";

/** Seuil population T1+T2 (aligné sur le SSG premium existant). */
export const HUB_MIN_POPULATION = 100_000;

/** Villes T1+T2 (40) listées dans le JobPosting France. */
export const HUB_VILLES: ReadonlyArray<VilleData> = VILLES_CORE.filter(
  (v) => v.population >= HUB_MIN_POPULATION,
);

/** Lieux (nom + région) des 40 hubs pour `JobPosting.jobLocation`. */
export function getHubLocations(): ReadonlyArray<{ nameFr: string; regionSlug: string }> {
  return HUB_VILLES.map((v) => ({ nameFr: v.nameFr, regionSlug: v.region }));
}
