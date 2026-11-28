import { getVillesCitablesMaillage, hasVilleCopy, isVilleIndexable } from "@/content/villes/core";
import { getRegion } from "@/content/regions";
import { REGIONS } from "@/content/regions";
import { projeter } from "./geo";

/** Nombre maximal de villes affichées (jamais de liste géante). */
export const NOMBRE_VILLES_PHARES = 12;

export interface VillePhare {
  slug: string;
  nom: string;
  population: number;
  /** Page de ville indexée : /implantations/<région>/<ville>. */
  href: string;
  /** Position sur la carte de France simplifiée (métropole), sinon null. */
  point: { x: number; y: number } | null;
}

/**
 * Les villes les plus peuplées parmi celles que le site cite déjà dans son maillage
 * (source : `getVillesCitablesMaillage`, filtrée sur les pages /implantations indexables).
 * Aucune ville ajoutée ou retirée à la main ; tri par population décroissante, puis slug.
 */
export function villesPhares(max: number = NOMBRE_VILLES_PHARES): VillePhare[] {
  return (
    [...getVillesCitablesMaillage()]
      // Seules les villes dont la page /implantations existe ET est indexable (copie rédigée,
      // cohorte indexée, région connue) : jamais de lien vers une page noindex.
      .filter((v) => hasVilleCopy(v.slug) && isVilleIndexable(v.slug) && getRegion(v.region))
      .sort((a, b) => b.population - a.population || a.slug.localeCompare(b.slug))
      .slice(0, Math.min(max, NOMBRE_VILLES_PHARES))
      .map((v) => ({
        slug: v.slug,
        nom: v.nameFr,
        population: v.population,
        href: `/implantations/${v.region}/${v.slug}`,
        point: projeter(v.geo.lat, v.geo.lon),
      }))
  );
}

/** Noms des régions de France (source : `REGIONS`), pour les pastilles. */
export function nomsRegions(): string[] {
  return REGIONS.map((r) => r.nameFr);
}
