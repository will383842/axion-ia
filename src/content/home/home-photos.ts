/**
 * SSOT — Photos Unsplash des bandes média de l'accueil (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-home-unsplash.mjs. Photos téléchargées en local
 * (`public/illustrations/home/{slot}.avif`) → 0 hotlink externe.
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe rendue (§9) via <UnsplashCreditList>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 *
 * `slot` = clé stable alignée sur les blocs de la home :
 *   why-01…06        → WhyDifferentiators
 *   audience-01…04   → AudienceSegments
 */

export interface HomePhotoCredit {
  readonly slot: string;
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly alt: string;
}

export const HOME_PHOTO_CREDITS: Record<string, HomePhotoCredit> = {
  "why-01-aucun-intermediaire": {
    slot: "why-01-aucun-intermediaire",
    photoId: "oUKiDSdTTyg",
    photographer: "Croissant",
    photographerUrl: "https://unsplash.com/@getcroissant",
    photoUrl: "https://unsplash.com/photos/oUKiDSdTTyg",
    alt: "man and woman using laptop on table",
  },
  "why-02-cinq-metiers": {
    slot: "why-02-cinq-metiers",
    photoId: "rxpThOwuVgE",
    photographer: "Austin Distel",
    photographerUrl: "https://unsplash.com/@austindistel",
    photoUrl: "https://unsplash.com/photos/rxpThOwuVgE",
    alt: "man standing in front of group of men",
  },
  "why-03-couverture": {
    slot: "why-03-couverture",
    photoId: "gOo_obZO0Ec",
    photographer: "Jerry Kavan",
    photographerUrl: "https://unsplash.com/@jerrykavan",
    photoUrl: "https://unsplash.com/photos/gOo_obZO0Ec",
    alt: "aerial photography of buildings",
  },
  "why-04-meme-expert": {
    slot: "why-04-meme-expert",
    photoId: "oCD1HUJmFIM",
    photographer: "Christian Velitchkov",
    photographerUrl: "https://unsplash.com/@cvelitchkov",
    photoUrl: "https://unsplash.com/photos/oCD1HUJmFIM",
    alt: "man in black long sleeve shirt sitting in front of macbook",
  },
  "why-05-votre-rythme": {
    slot: "why-05-votre-rythme",
    photoId: "Mw9KxYkqsnk",
    photographer: "Marissa Grootes",
    photographerUrl: "https://unsplash.com/@marissacristina",
    photoUrl: "https://unsplash.com/photos/Mw9KxYkqsnk",
    alt: "person touching white spiral notebook",
  },
  "why-06-meme-exigence": {
    slot: "why-06-meme-exigence",
    photoId: "S6wHfOpdGkY",
    photographer: "Angelina Litvin",
    photographerUrl: "https://unsplash.com/@linalitvina",
    photoUrl: "https://unsplash.com/photos/S6wHfOpdGkY",
    alt: "person carving on black wood plank",
  },
  "audience-01-tpe": {
    slot: "audience-01-tpe",
    photoId: "bdO_mCH27dE",
    photographer: "Giovanni Simonicca",
    photographerUrl: "https://unsplash.com/@joexcam",
    photoUrl: "https://unsplash.com/photos/bdO_mCH27dE",
    alt: "Two men working at olivier's bakery stall with baked goods.",
  },
  "audience-02-pme": {
    slot: "audience-02-pme",
    photoId: "g1Kr4Ozfoac",
    photographer: "Brooke Cagle",
    photographerUrl: "https://unsplash.com/@brookecagle",
    photoUrl: "https://unsplash.com/photos/g1Kr4Ozfoac",
    alt: "three people sitting in front of table laughing together",
  },
  "audience-03-eti": {
    slot: "audience-03-eti",
    photoId: "QBpZGqEMsKg",
    photographer: "Alex Kotliarskyi",
    photographerUrl: "https://unsplash.com/@frantic",
    photoUrl: "https://unsplash.com/photos/QBpZGqEMsKg",
    alt: "people doing office works",
  },
  "audience-04-grands-comptes": {
    slot: "audience-04-grands-comptes",
    photoId: "KatP61RjRT0",
    photographer: "DM David",
    photographerUrl: "https://unsplash.com/@dm_david",
    photoUrl: "https://unsplash.com/photos/KatP61RjRT0",
    alt: "Modern glass building against a clear blue sky.",
  },
} as const;

export function getHomePhotoCredit(slot: string): HomePhotoCredit | undefined {
  return HOME_PHOTO_CREDITS[slot];
}

/** Chemin public du visuel d'un slot. */
export function homePhotoSrc(slot: string): string {
  return `/illustrations/home/${slot}.avif`;
}
