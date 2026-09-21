// Villes T1+T2 (population ≥ 100 000) — les « hubs » du maillage recrutement.
// Décision Will 2026-06-08 : une seule page France indexée, pas de pages ville
// quasi-dupliquées (anti-doorway).
//
// Consommées aujourd'hui par la page /carrieres (villes citées) et le widget
// ville des offres d'emploi (`lib/careers/city-widget.ts`).
//
// 2026-09-19 (décision Will B5) : `getHubLocations()`, qui fournissait les 40
// lieux de l'offre d'emploi schema.org multi-lieux de /devenir-commercial-ia,
// est retirée avec ce balisage — un apporteur d'affaires indépendant n'est pas
// un poste. Elle n'avait plus aucun appelant.

import { VILLES_CORE, type VilleData } from "@/content/villes/core";

/** Seuil population T1+T2 (aligné sur le SSG premium existant). */
export const HUB_MIN_POPULATION = 100_000;

/** Villes T1+T2 (40). */
export const HUB_VILLES: ReadonlyArray<VilleData> = VILLES_CORE.filter(
  (v) => v.population >= HUB_MIN_POPULATION,
);
