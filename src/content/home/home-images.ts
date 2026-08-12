/**
 * SSOT — textes alternatifs et dimensions des bandes média de l'accueil.
 *
 * Séparé de `home-photos.ts` À DESSEIN : ce dernier est AUTO-GÉNÉRÉ par le
 * script de curation et ne porte que les crédits + l'`alt` anglais renvoyé par
 * l'API Unsplash. Les textes ci-dessous sont écrits à la main, en FR et EN,
 * et survivent donc à une re-curation.
 *
 * Règle d'écriture : l'alternative DÉCRIT la photo, elle ne répète pas le titre
 * de la carte (un lecteur d'écran annoncerait deux fois la même chose).
 *
 * `width`/`height` = dimensions réelles des fichiers produits par le script
 * (16:9, 1600×900). Les reprendre telles quelles dans PAGE_IMAGES_MANIFEST.
 */

export interface HomeImage {
  readonly src: string;
  readonly altFr: string;
  readonly altEn: string;
  readonly width: number;
  readonly height: number;
}

const W = 1600;
const H = 900;

function img(slot: string, altFr: string, altEn: string): HomeImage {
  return { src: `/illustrations/home/${slot}.avif`, altFr, altEn, width: W, height: H };
}

export const HOME_IMAGES: Record<string, HomeImage> = {
  "why-01-aucun-intermediaire": img(
    "why-01-aucun-intermediaire",
    "Deux professionnels travaillent côte à côte sur un ordinateur portable",
    "Two professionals working side by side on a laptop",
  ),
  "why-02-cinq-metiers": img(
    "why-02-cinq-metiers",
    "Une équipe pluridisciplinaire réunie autour d'un même projet",
    "A multidisciplinary team gathered around a single project",
  ),
  "why-03-couverture": img(
    "why-03-couverture",
    "Vue aérienne des toits d'une ville en plein jour",
    "Aerial view of city rooftops in daylight",
  ),
  "why-04-meme-expert": img(
    "why-04-meme-expert",
    "Un intervenant concentré sur son poste de travail",
    "A consultant focused at their workstation",
  ),
  "why-05-votre-rythme": img(
    "why-05-votre-rythme",
    "Un carnet de notes ouvert sur un plan de travail personnel",
    "An open notebook on a personal workspace",
  ),
  "why-06-meme-exigence": img(
    "why-06-meme-exigence",
    "Des mains d'artisan au travail, geste précis sur un ouvrage",
    "A craftsman's hands at work, a precise gesture on a piece",
  ),
  "audience-01-tpe": img(
    "audience-01-tpe",
    "Un artisan derrière le comptoir de son commerce",
    "A craftsman behind the counter of their shop",
  ),
  "audience-02-pme": img(
    "audience-02-pme",
    "Une petite équipe en réunion autour d'une table",
    "A small team meeting around a table",
  ),
  "audience-03-eti": img(
    "audience-03-eti",
    "Des salariés au travail dans un plateau de bureaux ouvert",
    "Employees at work in an open-plan office",
  ),
  "audience-04-grands-comptes": img(
    "audience-04-grands-comptes",
    "Façade vitrée d'un immeuble de bureaux dans un quartier d'affaires",
    "Glass facade of an office building in a business district",
  ),
} as const;

export function getHomeImage(slot: string): HomeImage | undefined {
  return HOME_IMAGES[slot];
}

/** Visuel prêt à passer au composant : `{ src, alt }` dans la bonne langue. */
export function homeImageFor(
  slot: string,
  isFr: boolean,
): { src: string; alt: string } | undefined {
  const i = HOME_IMAGES[slot];
  if (!i) return undefined;
  return { src: i.src, alt: isFr ? i.altFr : i.altEn };
}
