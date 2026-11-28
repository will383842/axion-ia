import { getVillesCitablesMaillage } from "@/content/villes/core";
import { REGIONS } from "@/content/regions";
import { projeter } from "./geo";

/** Nombre maximal de villes affichées (jamais de liste géante). */
export const NOMBRE_VILLES_PHARES = 12;

export interface VillePhare {
  slug: string;
  nom: string;
  population: number;
  /** Page de ville existante. */
  href: string;
  /** Position sur la carte de France simplifiée (métropole), sinon null. */
  point: { x: number; y: number } | null;
}

/**
 * Les villes les plus peuplées parmi celles que le site cite déjà dans son maillage
 * (source unique : `getVillesCitablesMaillage`, la même que les pages « par ville »).
 * Aucune ville ajoutée ou retirée à la main ; tri par population décroissante, puis slug.
 */
export function villesPhares(max: number = NOMBRE_VILLES_PHARES): VillePhare[] {
  return [...getVillesCitablesMaillage()]
    .sort((a, b) => b.population - a.population || a.slug.localeCompare(b.slug))
    .slice(0, Math.min(max, NOMBRE_VILLES_PHARES))
    .map((v) => ({
      slug: v.slug,
      nom: v.nameFr,
      population: v.population,
      href: `/audit/par-ville/${v.slug}`,
      point: projeter(v.geo.lat, v.geo.lon),
    }));
}

/** Noms des régions de France (source : `REGIONS`), pour les pastilles. */
export function nomsRegions(): string[] {
  return REGIONS.map((r) => r.nameFr);
}
