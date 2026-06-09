// Filtrage par ville du widget embarquable d'offres d'emploi.
//
// Une annonce peut viser : une ville (`city`), plusieurs villes (`jobLocations`,
// postes itinérants/territoriaux → visible dans le widget de CHAQUE ville sans
// page dupliquée), ou être en remote. Le widget `?city=Lyon` affiche donc :
//   ville principale = Lyon  OU  jobLocations inclut Lyon  OU  remote.
// → honnête (le remote garantit du contenu, jamais de widget vide), sans doorway
// (query-param sur la route noindex). Fonctions pures → testables sans Prisma.

import { HUB_VILLES } from "@/content/recrutement/satellites";
import type { JobOffer } from "../../../prisma/generated/client";

// Villes proposées dans le configurateur — mêmes 41 que le hub /carrieres :
// Saint-Marcellin (siège) + les 40 hubs (population ≥ 100 000). Liste curée
// (pas dérivée des offres) → stable, pas de valeurs parasites.
export const CAREER_WIDGET_CITIES: ReadonlyArray<string> = [
  "Saint-Marcellin",
  ...HUB_VILLES.map((v) => v.nameFr),
];

/** Normalise pour comparaison : minuscules, sans accents, séparateurs → espace. */
function normalizeCity(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques combinants
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Index normalisé → nom canonique (affichage), construit une fois.
const CANONICAL_BY_NORM = new Map<string, string>(
  CAREER_WIDGET_CITIES.map((c) => [normalizeCity(c), c] as const),
);

/**
 * Résout un paramètre `?city=` (slug ou nom, accents/casse libres) vers le nom
 * de ville canonique. Renvoie `null` si la valeur n'est pas une ville connue
 * (→ le widget affiche alors toutes les offres, et on n'injecte pas de texte
 * arbitraire dans le titre).
 */
export function resolveWidgetCity(param: string | undefined | null): string | null {
  if (!param) return null;
  return CANONICAL_BY_NORM.get(normalizeCity(param)) ?? null;
}

/** Villes multi-localisation d'une offre (postes itinérants), défensif. */
function offerJobLocationCities(offer: Pick<JobOffer, "jobLocations">): string[] {
  if (!Array.isArray(offer.jobLocations)) return [];
  return (offer.jobLocations as Array<{ city?: string }>)
    .map((l) => l?.city)
    .filter((c): c is string => Boolean(c));
}

type CityMatchFields = Pick<JobOffer, "city" | "workMode" | "jobLocations">;

/** `true` si l'offre est pertinente pour `canonicalCity` (ville/multi-villes/remote). */
export function offerMatchesCity(offer: CityMatchFields, canonicalCity: string): boolean {
  if (offer.workMode === "remote") return true; // remote = pertinent partout
  const target = normalizeCity(canonicalCity);
  if (offer.city && normalizeCity(offer.city) === target) return true;
  return offerJobLocationCities(offer).some((c) => normalizeCity(c) === target);
}

/** Filtre les offres pour une ville canonique ; `null` = aucune restriction. */
export function filterOffersByCity<T extends CityMatchFields>(
  offers: T[],
  canonicalCity: string | null,
): T[] {
  if (!canonicalCity) return offers;
  return offers.filter((o) => offerMatchesCity(o, canonicalCity));
}
