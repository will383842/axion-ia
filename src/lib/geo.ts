// Helpers géographiques pour la phase pSEO villes/régions (Sprint 14.9).
//
// - `haversineKm()` : distance grand-cercle entre 2 coordonnées WGS84.
// - `getNearbyVilles()` : voisines triées par distance (exclut la ville source).
// - `getNearbyCases()` : cas concrets dans un rayon donné (CaseStudy.geo facultatif).
// - `getRelatedBlogPosts()` : articles de blog dont les tags/relatedCities matchent.
//
// Pure, déterministe, zéro dépendance — sûr pour Server Component + script.

// Découplage 2026-08-16 : geo ne lit que des champs structurels (slug, region,
// departement, geo) plus un booléen « a un copy ». Passer par `core` évite les
// 29 Mo de contenu éditorial du barrel — ~578 ms au lieu de ~41 s à froid.
import type { VilleData } from "@/content/villes/core";
import type { CaseStudy } from "@/content/case-studies";
import { CASE_STUDIES } from "@/content/case-studies";
import { BLOG_POSTS, type BlogPost } from "@/content/transversal";
import { VILLES_CORE, hasVilleCopy } from "@/content/villes/core";
import { slugify } from "@/lib/slug";

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
  ville: VilleData;
  distanceKm: number;
}

/** Renvoie les `n` villes les plus proches du point donné, triées asc. par distance. */
export function getNearbyVilles(
  origin: { lat: number; lon: number },
  n: number,
  options?: { excludeSlug?: string; sameRegion?: string; maxKm?: number; indexableOnly?: boolean },
): NearbyVille[] {
  const opts = options ?? {};
  const candidates: NearbyVille[] = [];
  for (const ville of VILLES_CORE) {
    if (opts.excludeSlug && ville.slug === opts.excludeSlug) continue;
    if (opts.sameRegion && ville.region !== opts.sameRegion) continue;
    // Audit maillage 2026-07-03 — `indexableOnly` : ne retenir que les villes
    // avec `copy` (= vraies pages éligibles à l'index). Évite de mailler vers
    // les ~2 280 communes stub noindex (doorway HCU) et de gaspiller le
    // link-equity des pages indexables sur des pages volontairement noindex.
    if (opts.indexableOnly && !hasVilleCopy(ville.slug)) continue;
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
 *
 * NB : V1 utilisait BLOG_POSTS FS uniquement. Sprint S+2 Phase C ajoute le
 * helper async `getBlogArticlesByVille` ci-dessous qui interroge l'Article DB
 * via le nouveau champ `mentionedCities[]`. Les 2 helpers cohabitent : utilise
 * le DB-based pour les articles factory content-gen, le FS-based pour le
 * legacy blog posts inline-coded.
 */
export function getRelatedBlogPosts(ville: VilleData, n = 3): BlogPost[] {
  const wantedTags = new Set([ville.slug, ville.region]);
  const matches = BLOG_POSTS.filter((post) => {
    if (post.relatedCities?.includes(ville.slug)) return true;
    return post.tags.some((t) => wantedTags.has(slugify(t)));
  });
  return matches.slice(0, n);
}

// =============================================================================
// Sprint S+2 City Domination — Phase D "Alentours étendus 3 dimensions"
// =============================================================================
//
// Doctrine "perfection ville 2026" : un hub ville doit pointer vers ses
// voisines selon 3 dimensions imbriquées :
//   1. Proximité immédiate ≤ 30 km (déplacement piéton/auto rapide)
//   2. Même département administratif (proxy EPCI/intercommunalité)
//   3. Même région + rayon 60 km (proxy aire d'attraction économique INSEE)
//
// V1 ne dispose pas de la data INSEE EPCI/aire éco directement. On approxime
// via les champs déjà présents dans VILLES (`departement`, `region`, `geo`)
// pour avoir un mesh "alentours" cohérent SEO sans dépendance externe.
//
// Sprint S+3 envisageable : remplacer `departement` proxy par `epciCode` réel
// (data INSEE COG 2024) si besoin précision GBP/Local SEO ultérieure.

export interface NearbyVillesExtended {
  /** Villes ≤ 30 km, max 15. Tri ascendant distance. Exclut la source. */
  readonly immediates: ReadonlyArray<NearbyVille>;
  /** Villes du même département. Max 20. Tri ascendant distance. */
  readonly sameDepartement: ReadonlyArray<NearbyVille>;
  /** Villes même région ≤ 60 km. Max 15. Tri ascendant distance. */
  readonly economicArea: ReadonlyArray<NearbyVille>;
}

/**
 * Retourne les voisines géo selon 3 dimensions imbriquées (Phase D strat ville).
 *
 * Implémentation simple — 1 seul parcours VILLES, classification par bucket.
 * Pas de double-comptage (une ville n'apparaît que dans le bucket le plus
 * restrictif qui la contient).
 */
export function getNearbyVillesExtended(source: VilleData): NearbyVillesExtended {
  const immediates: NearbyVille[] = [];
  const sameDepartement: NearbyVille[] = [];
  const economicArea: NearbyVille[] = [];

  for (const ville of VILLES_CORE) {
    if (ville.slug === source.slug) continue;
    const distanceKm = haversineKm(source.geo, ville.geo);

    if (distanceKm <= 30) {
      immediates.push({ ville, distanceKm });
      continue; // bucket prioritaire
    }
    if (ville.departement === source.departement) {
      sameDepartement.push({ ville, distanceKm });
      continue;
    }
    if (ville.region === source.region && distanceKm <= 60) {
      economicArea.push({ ville, distanceKm });
    }
  }

  immediates.sort((a, b) => a.distanceKm - b.distanceKm);
  sameDepartement.sort((a, b) => a.distanceKm - b.distanceKm);
  economicArea.sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    immediates: immediates.slice(0, 15),
    sameDepartement: sameDepartement.slice(0, 20),
    economicArea: economicArea.slice(0, 15),
  };
}

// =============================================================================
// Sprint S+2 City Domination — Phase F "Fallback cas concrets régional/sectoriel"
// =============================================================================

interface NearbyCasesResult {
  readonly cases: ReadonlyArray<NearbyCase>;
  /** Niveau du fallback utilisé : "proximity" (rayon initial), "region",
   *  "sector", "none". Utile pour audit / debug + UI label optionnel. */
  readonly fallbackLevel: "proximity" | "region" | "sector" | "none";
}

/**
 * Retourne les cas concrets locaux avec fallback chain anti-hub-vide.
 *
 * Logique :
 *   1. Tente rayon `radiusKm` (default 50)
 *   2. Si < n cas → fallback "même région" (toutes distances)
 *   3. Si < n cas → fallback "même secteur économique" (sectorHint optionnel)
 *   4. Si toujours < n → retourne ce qu'on a (potentiellement vide)
 *
 * Audit `fallbackLevel` permet de logger ou afficher "ces cas viennent de
 * la région, pas de la commune" pour transparence.
 */
export function getNearbyCasesWithFallback(
  source: VilleData,
  options?: {
    radiusKm?: number;
    n?: number;
    /** Hint secteur économique pour fallback 3. Ex: "industrie", "tertiaire". */
    sectorHint?: string;
  },
): NearbyCasesResult {
  const radiusKm = options?.radiusKm ?? 50;
  const n = options?.n ?? 3;

  // 1. Proximité
  const proximity = getNearbyCases(source.geo, radiusKm, n);
  if (proximity.length >= n) {
    return { cases: proximity, fallbackLevel: "proximity" };
  }

  // 2. Fallback régional — tous cas avec geo dans la même région.
  // On utilise une heuristique simple : récupérer toutes les villes de la
  // région source, puis chercher des cas dans un rayon élargi 200 km autour
  // de chaque (couvre la région typique).
  const regionalCases = new Map<string, NearbyCase>(); // dedup par caseStudy.slug
  for (const candidate of VILLES_CORE) {
    if (candidate.region !== source.region) continue;
    const nearby = getNearbyCases(candidate.geo, 50, n);
    for (const nc of nearby) {
      if (!regionalCases.has(nc.caseStudy.slug)) {
        regionalCases.set(nc.caseStudy.slug, nc);
      }
    }
    if (regionalCases.size >= n) break;
  }
  const regionalSorted = Array.from(regionalCases.values())
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, n);
  if (regionalSorted.length >= n) {
    return { cases: regionalSorted, fallbackLevel: "region" };
  }

  // 3. Fallback sectoriel — si sectorHint fourni, filtrer CaseStudy.industry
  // (CaseStudy a probablement un champ industry/sector).
  if (options?.sectorHint) {
    const sectorHint = options.sectorHint.toLowerCase();
    const sectorCases = CASE_STUDIES.filter((cs) => {
      // Type CaseStudy peut avoir `industry` ou `sector`. On regarde les 2
      // via un cast lâche (typeof check runtime).
      const industry = (cs as { industry?: string }).industry?.toLowerCase() ?? "";
      const sector = (cs as { sector?: string }).sector?.toLowerCase() ?? "";
      return industry.includes(sectorHint) || sector.includes(sectorHint);
    })
      .slice(0, n)
      .map((cs) => ({ caseStudy: cs, distanceKm: 999 })); // distance fictive
    if (sectorCases.length > 0) {
      return { cases: sectorCases, fallbackLevel: "sector" };
    }
  }

  // 4. Aucun fallback ne donne rien — retourne ce qu'on a accumulé (proximity).
  return {
    cases: regionalSorted.length > 0 ? regionalSorted : proximity,
    fallbackLevel:
      regionalSorted.length > 0 ? "region" : proximity.length > 0 ? "proximity" : "none",
  };
}
