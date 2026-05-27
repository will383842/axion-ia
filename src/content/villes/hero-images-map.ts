// AUTO-GENERATED 2026-05-27 — Audit Will images hero villes.
// Set des slugs villes qui ont une image hero custom dans `public/villes-hero/`.
// Utilisé par `src/app/[locale]/implantations/[region]/[ville]/page.tsx`
// pour basculer entre hero universel (placeholder) et hero ville-spécifique.
//
// Pour ajouter une nouvelle ville : déposer 3 fichiers (avif/webp/jpg) dans
// `public/villes-hero/{slug}.{format}` puis ajouter le slug à la constante.
// Ou ré-exécuter `pnpm tsx scripts/process-villes-hero-images.ts`.

export const VILLES_WITH_HERO_IMAGE: ReadonlySet<string> = new Set([
  "aix-en-provence",
  "amiens",
  "angers",
  "annecy",
  "argenteuil",
  "asnieres-sur-seine",
  "aubervilliers",
  "aulnay-sous-bois",
  "avignon",
  "besancon",
  "bordeaux",
  "boulogne-billancourt",
  "brest",
  "caen",
  "cannes",
  "clermont-ferrand",
  "colombes",
  "courbevoie",
  "creteil",
  "dijon",
  "dunkerque",
  "grenoble",
  "le-havre",
  "le-mans",
  "lille",
  "limoges",
  "lyon",
  "marseille",
  "metz",
  "montelimar",
  "montpellier",
  "montreuil",
  "mulhouse",
  "nancy",
  "nanterre",
  "nantes",
  "nice",
  "nimes",
  "orleans",
  "paris",
  "perpignan",
  "poitiers",
  "reims",
  "rennes",
  "romans-sur-isere",
  "roubaix",
  "rouen",
  "rueil-malmaison",
  "saint-chamond",
  "saint-denis",
  "saint-etienne",
  "saint-marcellin",
  "strasbourg",
  "toulon",
  "tourcoing",
  "tours",
  "versailles",
  "villeurbanne",
  "vitry-sur-seine",
]);

export function hasVilleHeroImage(slug: string): boolean {
  return VILLES_WITH_HERO_IMAGE.has(slug);
}
