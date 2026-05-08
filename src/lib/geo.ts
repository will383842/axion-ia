// Helpers géographiques pour la phase pSEO villes/régions (Sprint 14.9).
//
// - `haversineKm()` : distance grand-cercle entre 2 coordonnées WGS84.
// - `getNearbyVilles()` : voisines triées par distance (exclut la ville source).
// - `getNearbyCases()` : cas concrets dans un rayon donné (CaseStudy.geo facultatif).
// - `getRelatedBlogPosts()` : articles de blog dont les tags/relatedCities matchent.
//
// Pure, déterministe, zéro dépendance — sûr pour Server Component + script.

import type { Ville } from "@/content/villes";
import type { CaseStudy } from "@/content/case-studies";
import { CASE_STUDIES } from "@/content/case-studies";
import { BLOG_POSTS, type BlogPost } from "@/content/transversal";
import { VILLES } from "@/content/villes";

const EARTH_RADIUS_KM = 6371;

/** Distance grand-cercle en kilomètres (formule de Haversine). */
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface NearbyVille {
  ville: Ville;
  distanceKm: number;
}

/** Renvoie les `n` villes les plus proches du point donné, triées asc. par distance. */
export function getNearbyVilles(
  origin: { lat: number; lon: number },
  n: number,
  options?: { excludeSlug?: string; sameRegion?: string; maxKm?: number },
): NearbyVille[] {
  const opts = options ?? {};
  const candidates: NearbyVille[] = [];
  for (const ville of VILLES) {
    if (opts.excludeSlug && ville.slug === opts.excludeSlug) continue;
    if (opts.sameRegion && ville.region !== opts.sameRegion) continue;
    const distanceKm = haversineKm(origin, ville.geo);
    if (typeof opts.maxKm === "number" && distanceKm > opts.maxKm) continue;
    candidates.push({ ville, distanceKm });
  }
  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  return candidates.slice(0, n);
}

interface NearbyCase {
  caseStudy: CaseStudy;
  distanceKm: number;
}

/**
 * Renvoie les cas concrets dont le champ `geo` (optionnel) est dans le rayon
 * `radiusKm`. Quand `geo` n'est pas renseigné sur un cas, il est ignoré (pas
 * d'inférence depuis l'industry — anti-hallucination Will).
 */
export function getNearbyCases(
  origin: { lat: number; lon: number },
  radiusKm: number,
  n = 3,
): NearbyCase[] {
  const out: NearbyCase[] = [];
  for (const cs of CASE_STUDIES) {
    if (!cs.geo) continue;
    const distanceKm = haversineKm(origin, cs.geo);
    if (distanceKm > radiusKm) continue;
    out.push({ caseStudy: cs, distanceKm });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, n);
}

/**
 * Articles de blog liés à une ville. Match :
 *   1. `post.relatedCities` contient `ville.slug`, OU
 *   2. `post.tags` contient le slug ville ou région.
 * Aucun fallback "tous les articles récents" — silence si rien ne matche
 * (anti-doorway HCU 2024).
 */
export function getRelatedBlogPosts(ville: Ville, n = 3): BlogPost[] {
  const slugify = (s: string): string =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const wantedTags = new Set([ville.slug, ville.region]);
  const matches = BLOG_POSTS.filter((post) => {
    if (post.relatedCities?.includes(ville.slug)) return true;
    return post.tags.some((t) => wantedTags.has(slugify(t)));
  });
  return matches.slice(0, n);
}
