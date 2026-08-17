/**
 * SSOT — Photos Unsplash des emplacements éditoriaux des pages de contenu
 * (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-pages-editoriales-unsplash.mjs. Photos
 * téléchargées en local → 0 hotlink externe.
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe rendue (§9) via <UnsplashCredit>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 *
 * `width`/`height` sont les dimensions RÉELLES du fichier : les reprendre
 * telles quelles dans PAGE_IMAGES_MANIFEST, sinon CLS et JSON-LD faux.
 */

export interface EditorialPhoto {
  readonly slot: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly alt: string;
}

export const EDITORIAL_PHOTOS: Record<string, EditorialPhoto> = {
  "centre-aide-hero": {
    slot: "centre-aide-hero",
    src: "/illustrations/centre-aide-hero.avif",
    width: 1600,
    height: 900,
    photoId: "yDIDeepDoQA",
    photographer: "Brett Wharton",
    photographerUrl: "https://unsplash.com/@brettwharton",
    photoUrl: "https://unsplash.com/photos/yDIDeepDoQA",
    alt: "A living room filled with lots of books and furniture",
  },
  "cas-concrets-mid-1": {
    slot: "cas-concrets-mid-1",
    src: "/illustrations/cas-concrets-mid-1.avif",
    width: 1600,
    height: 900,
    photoId: "6EnTPvPPL6I",
    photographer: "Isaac Smith",
    photographerUrl: "https://unsplash.com/@isaacmsmith",
    photoUrl: "https://unsplash.com/photos/6EnTPvPPL6I",
    alt: "pen on paper",
  },
  "comparaisons-mid-1": {
    slot: "comparaisons-mid-1",
    src: "/illustrations/comparaisons-mid-1.avif",
    width: 1200,
    height: 1200,
    photoId: "7lryofJ0H9s",
    photographer: "Kaleidico",
    photographerUrl: "https://unsplash.com/@kaleidico",
    photoUrl: "https://unsplash.com/photos/7lryofJ0H9s",
    alt: "man drawing on dry-erase board",
  },
  "guide-ia-hero": {
    slot: "guide-ia-hero",
    src: "/illustrations/guide-ia-hero.avif",
    width: 1600,
    height: 900,
    photoId: "9PwLeZA-RGc",
    photographer: "Jakub Żerdzicki",
    photographerUrl: "https://unsplash.com/@jakubzerdzicki",
    photoUrl: "https://unsplash.com/photos/9PwLeZA-RGc",
    alt: "a person holding a piece of paper over a laptop",
  },
  "guide-ia-closing": {
    slot: "guide-ia-closing",
    src: "/illustrations/guide-ia-closing.avif",
    width: 1600,
    height: 900,
    photoId: "E_-URe754nM",
    photographer: "Josh Applegate",
    photographerUrl: "https://unsplash.com/@joshapplegate",
    photoUrl: "https://unsplash.com/photos/E_-URe754nM",
    alt: "person holding white book",
  },
  "stack-ia-closing": {
    slot: "stack-ia-closing",
    src: "/illustrations/stack-ia-closing.avif",
    width: 1600,
    height: 900,
    photoId: "t5YUoHW6zRo",
    photographer: "Barn Images",
    photographerUrl: "https://unsplash.com/@barnimages",
    photoUrl: "https://unsplash.com/photos/t5YUoHW6zRo",
    alt: "assorted handheld tools in tool rack",
  },
  "methodologie-demarche": {
    slot: "methodologie-demarche",
    src: "/illustrations/methodologie-demarche.avif",
    width: 1600,
    height: 900,
    photoId: "uOhBxB23Wao",
    photographer: "ThisisEngineering",
    photographerUrl: "https://unsplash.com/@thisisengineering",
    photoUrl: "https://unsplash.com/photos/uOhBxB23Wao",
    alt: "two colleagues discussing ideas at whiteboard",
  },
  "methodologie-terrain": {
    slot: "methodologie-terrain",
    src: "/illustrations/methodologie-terrain.avif",
    width: 1600,
    height: 900,
    photoId: "Jk3u514GJes",
    photographer: "LinkedIn Sales Solutions",
    photographerUrl: "https://unsplash.com/@linkedinsalesnavigator",
    photoUrl: "https://unsplash.com/photos/Jk3u514GJes",
    alt: "woman in black blazer sitting at the table",
  },
} as const;

export function getEditorialPhoto(slot: string): EditorialPhoto | undefined {
  return EDITORIAL_PHOTOS[slot];
}
