/**
 * SSOT — Photos Unsplash de la page /a-propos (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-a-propos-unsplash.mjs. Photos téléchargées en
 * local (`public/illustrations/a-propos/{slot}.avif`) → 0 hotlink externe.
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe rendue (§9) via <UnsplashCredit>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 */

export interface AboutPhotoCredit {
  readonly slot: string;
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly alt: string;
}

export const ABOUT_PHOTO_CREDITS: Record<string, AboutPhotoCredit> = {
  valeurs: {
    slot: "valeurs",
    photoId: "88s0zVMLSqc",
    photographer: "Nirmal Rajendharkumar",
    photographerUrl: "https://unsplash.com/@neotronimz",
    photoUrl: "https://unsplash.com/photos/88s0zVMLSqc",
    alt: "man wearing headset drawing",
  },
  closing: {
    slot: "closing",
    photoId: "e6n7uoEnYbA",
    photographer: "Campaign Creators",
    photographerUrl: "https://unsplash.com/@campaign_creators",
    photoUrl: "https://unsplash.com/photos/e6n7uoEnYbA",
    alt: "woman sitting at table",
  },
} as const;
