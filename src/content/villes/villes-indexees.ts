// SOURCE UNIQUE de vérité : villes dont la page /fr/implantations/<région>/<ville>
// est INDEXÉE par les moteurs (décision de la direction, 18/11/2026).
//
// Pages locales indexées au total : 59 = 1 hub France + 18 régions + 40 villes.
// Toutes les autres pages ville et toutes les pages service × ville
// (`*/par-ville/<ville>`) restent EN LIGNE, en `noindex, follow`, hors sitemaps :
// aucune suppression, aucun changement d'URL.
//
// RÈGLE DE LA LISTE : communes de 100 000 habitants ou plus (recensement INSEE
// porté par `data/*.ts`). Une ville plus petite n'entre qu'avec une preuve écrite
// d'intervention et l'accord de la direction. Pas d'Ajaccio : la page Corse suffit.
//
// Cette liste est lue par `isVilleIndexable()` (core.ts), donc par : le meta
// robots des pages ville, les sitemaps villes et images, l'outil site-explorer et,
// via `src/generated/indexable-villes.ts` (régénéré par
// `pnpm tsx scripts/gen-indexable-villes.ts`), l'en-tête Edge X-Robots-Tag.
//
// RÈGLE DE COMMUNICATION : la page de Grenoble existe et reste visible, mais la
// ville n'est jamais citée sur la page France, les pages régions hors
// Auvergne-Rhône-Alpes, les pages des autres villes ni les listes « nos villes ».
//
// Retour arrière : revert de ce fichier (et du fichier généré).
// Edge-safe : littéral pur, aucun import.

export const VILLES_INDEXEES_SLUGS: ReadonlyArray<string> = [
  // Île-de-France
  "paris",
  "saint-denis",
  "boulogne-billancourt",
  "montreuil",
  "argenteuil",
  // Provence-Alpes-Côte d'Azur
  "marseille",
  "nice",
  "toulon",
  "aix-en-provence",
  // Auvergne-Rhône-Alpes
  "lyon",
  "saint-etienne",
  "villeurbanne",
  "grenoble",
  "clermont-ferrand",
  "annecy",
  // Occitanie
  "toulouse",
  "montpellier",
  "nimes",
  "perpignan",
  // Pays de la Loire
  "nantes",
  "angers",
  "le-mans",
  // Grand Est
  "strasbourg",
  "reims",
  "metz",
  "mulhouse",
  "nancy",
  // Nouvelle-Aquitaine
  "bordeaux",
  "limoges",
  // Hauts-de-France
  "lille",
  "amiens",
  // Bretagne
  "rennes",
  "brest",
  // Normandie
  "le-havre",
  "rouen",
  "caen",
  // Bourgogne-Franche-Comté
  "dijon",
  "besancon",
  // Centre-Val de Loire
  "tours",
  "orleans",
];

/** Pour les accès O(1). */
export const VILLES_INDEXEES: ReadonlySet<string> = new Set(VILLES_INDEXEES_SLUGS);

/**
 * Villes dont la page existe et est indexée, mais qui ne sont JAMAIS citées dans le
 * maillage national : page France, pages régions hors Auvergne-Rhône-Alpes, pages
 * des autres villes, listes « nos villes » (règle de communication du 18/11/2026).
 */
export const VILLES_HORS_MAILLAGE: ReadonlySet<string> = new Set(["grenoble"]);

/** True si la ville peut être citée dans les listes de maillage des AUTRES pages. */
export function estCitableDansLeMaillage(slug: string): boolean {
  return !VILLES_HORS_MAILLAGE.has(slug);
}
