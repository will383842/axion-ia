/**
 * « Partout en France » : données du bloc de présence locale des fiches équipe (module PUR).
 *
 * Aucune ville n'est écrite à la main : elles viennent de la source des pages
 * `/audit/par-ville/<slug>` (`@/content/villes/core`, import léger : données INSEE sans contenu
 * éditorial). Ne sont retenues que les villes indexées ET citables dans le maillage, triées par
 * population décroissante. Formulation : « nous intervenons à … », jamais de bureau ni d'agence.
 */
import { REGIONS } from "@/content/regions";
import { getVillesCitablesMaillage } from "@/content/villes/core";

/** Nombre maximal de villes affichées (pas de liste géante). */
export const NOMBRE_VILLES_PRESENCE = 12;

export interface VillePresence {
  slug: string;
  nom: string;
  /** Chemin interne FR (clé de `pathnames` : `/audit/par-ville/[ville]`). */
  href: string;
}

/** Les régions de France (métropole et outre-mer), dans l'ordre de la source. */
export function regionsFrance(): ReadonlyArray<string> {
  return REGIONS.map((r) => r.nameFr);
}

/** Les plus grandes villes dont la page existe et est indexée, population décroissante. */
export function villesPresence(): ReadonlyArray<VillePresence> {
  return getVillesCitablesMaillage()
    .slice(0, NOMBRE_VILLES_PRESENCE)
    .map((v) => ({ slug: v.slug, nom: v.nameFr, href: `/audit/par-ville/${v.slug}` }));
}

/**
 * Code de département valide (« 38 », « 2A », « 974 »), sinon `null`. Un code inconnu ou vide
 * n'est jamais deviné.
 */
export function codeDepartementConnu(brut: string | null | undefined): string | null {
  const c = (brut ?? "").trim().toUpperCase();
  return /^(\d{2,3}|2[AB])$/.test(c) ? c : null;
}

/**
 * La ville d'une fiche, si elle est renseignée. La fiche publique (`fichePublique`) écarte déjà
 * les villes qui ne doivent pas être mises en avant : ce module ne fait que relayer.
 */
export function villeAffichable(brut: string | null | undefined): string | null {
  const v = (brut ?? "").trim();
  return v === "" ? null : v;
}

/** La phrase de lieu d'un collaborateur, ou `null` si ni ville ni département ne sont connus. */
export function phraseLieu(
  prenom: string,
  lieu: { ville?: string | null | undefined; departement?: string | null | undefined },
): string | null {
  const ville = villeAffichable(lieu.ville);
  if (ville) return `${prenom} travaille depuis ${ville} et intervient partout en France.`;
  const dep = codeDepartementConnu(lieu.departement);
  if (dep)
    return `${prenom} travaille depuis le département ${dep} et intervient partout en France.`;
  return null;
}
