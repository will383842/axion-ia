// Modèle hub-and-spoke pour le recrutement commercial (décision Will 2026-06-08).
//
// On ne génère QUE ~40 pages gold (villes T1+T2, population ≥ 100 000). Toutes
// les autres villes (T3/T4) sont des SATELLITES rattachés à leur hub le plus
// proche (distance Haversine sur les coordonnées INSEE réelles).
//
// Double usage du mapping :
//   1. AFFICHAGE — chaque hub liste ses satellites proches (« et alentours ») →
//      les noms T3/T4 apparaissent sur la page = ranking longue traîne + le
//      JobPosting porte plusieurs `jobLocation` (Google for Jobs couvre les
//      villes satellites).
//   2. REDIRECT — toute URL de ville satellite fait un 301/308 vers son hub
//      (zéro 404, on capte le trafic direct).
//
// Calcul pur et déterministe (pas de Date/Math.random), exécuté une fois à
// l'import — OK au build SSG.

import { VILLES, type Ville } from "@/content/villes";

/** Seuil population T1+T2 (aligné sur le SSG premium existant). */
export const HUB_MIN_POPULATION = 100_000;

/** Rayon max (km) pour AFFICHER une ville comme satellite « alentours » d'un hub. */
const DISPLAY_RADIUS_KM = 35;
/** Nombre max de satellites affichés par hub (les plus proches). */
const MAX_DISPLAYED_SATELLITES = 14;

/** Hubs = villes T1+T2 qui auront une page dédiée. */
export const HUB_VILLES: ReadonlyArray<Ville> = VILLES.filter(
  (v) => v.population >= HUB_MIN_POPULATION,
);

const HUB_SLUG_SET = new Set(HUB_VILLES.map((v) => v.slug));

export function isHubSlug(slug: string): boolean {
  return HUB_SLUG_SET.has(slug);
}

/** Distance Haversine en km entre deux points WGS84. */
function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface SatelliteEntry {
  readonly ville: Ville;
  readonly distanceKm: number;
}

/** Pré-calcul : pour chaque hub, ses villes satellites triées par distance. */
const SATELLITES_BY_HUB = new Map<string, SatelliteEntry[]>();
/** Pré-calcul : slug ville satellite → slug hub le plus proche (pour redirect). */
const HUB_FOR_SATELLITE = new Map<string, string>();

(() => {
  for (const hub of HUB_VILLES) SATELLITES_BY_HUB.set(hub.slug, []);

  for (const ville of VILLES) {
    if (HUB_SLUG_SET.has(ville.slug)) continue; // un hub n'est pas son propre satellite
    let bestHub: Ville | null = null;
    let bestDist = Infinity;
    for (const hub of HUB_VILLES) {
      const d = haversineKm(ville.geo.lat, ville.geo.lon, hub.geo.lat, hub.geo.lon);
      if (d < bestDist) {
        bestDist = d;
        bestHub = hub;
      }
    }
    if (!bestHub) continue;
    HUB_FOR_SATELLITE.set(ville.slug, bestHub.slug);
    SATELLITES_BY_HUB.get(bestHub.slug)!.push({ ville, distanceKm: bestDist });
  }

  // Tri par distance croissante pour l'affichage.
  for (const list of SATELLITES_BY_HUB.values()) {
    list.sort((a, b) => a.distanceKm - b.distanceKm);
  }
})();

/** Hub le plus proche d'une ville satellite (pour le redirect 301). null si introuvable. */
export function getHubForSatellite(slug: string): string | null {
  return HUB_FOR_SATELLITE.get(slug) ?? null;
}

/**
 * Satellites à AFFICHER pour un hub : les plus proches dans le rayon, plafonnés.
 * Retourne les noms FR (pour la copy) + slugs (pour un éventuel maillage futur).
 */
export function getDisplayedSatellites(
  hubSlug: string,
): ReadonlyArray<{ slug: string; nameFr: string; distanceKm: number }> {
  const list = SATELLITES_BY_HUB.get(hubSlug) ?? [];
  return list
    .filter((e) => e.distanceKm <= DISPLAY_RADIUS_KM)
    .slice(0, MAX_DISPLAYED_SATELLITES)
    .map((e) => ({
      slug: e.ville.slug,
      nameFr: e.ville.nameFr,
      distanceKm: Math.round(e.distanceKm),
    }));
}

/** Slugs de tous les hubs (pour generateStaticParams + sitemap). */
export function getHubSlugs(): ReadonlyArray<string> {
  return HUB_VILLES.map((v) => v.slug);
}
