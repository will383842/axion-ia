/**
 * SSOT — Photos Unsplash de la page /roi (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-roi-unsplash.mjs. Photos téléchargées en local
 * (`public/illustrations/roi/{slot}.avif`) → 0 hotlink externe.
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe rendue (§9) via <UnsplashCredit>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 *
 * `slot` = "hero" | "banner" | "redaction" | "recherche" | "synthese" | "reporting".
 */

export interface RoiPhotoCredit {
  readonly slot: string;
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly alt: string;
}

export const ROI_PHOTO_CREDITS: Record<string, RoiPhotoCredit> = {
  hero: {
    slot: "hero",
    photoId: "BlIhVfXbi9s",
    photographer: "Samantha Gades",
    photographerUrl: "https://unsplash.com/@srosinger3997",
    photoUrl: "https://unsplash.com/photos/BlIhVfXbi9s",
    alt: "white desk lamp beside green plant",
  },
  banner: {
    slot: "banner",
    photoId: "GCenSQVDFyw",
    photographer: "AllGo - An App For Plus Size People",
    photographerUrl: "https://unsplash.com/@canweallgo",
    photoUrl: "https://unsplash.com/photos/GCenSQVDFyw",
    alt: "three women gathered around a table",
  },
  redaction: {
    slot: "redaction",
    photoId: "npxXWgQ33ZQ",
    photographer: "Glenn Carstens-Peters",
    photographerUrl: "https://unsplash.com/@glenncarstenspeters",
    photoUrl: "https://unsplash.com/photos/npxXWgQ33ZQ",
    alt: "person using MacBook Pro",
  },
  recherche: {
    slot: "recherche",
    photoId: "1ZrHX1Kj594",
    photographer: "Vitaly Gariev",
    photographerUrl: "https://unsplash.com/@silverkblack",
    photoUrl: "https://unsplash.com/photos/1ZrHX1Kj594",
    alt: "a woman sitting at a desk using a laptop computer",
  },
  synthese: {
    slot: "synthese",
    photoId: "hjwKMkehBco",
    photographer: "Álvaro Serrano",
    photographerUrl: "https://unsplash.com/@alvaroserrano",
    photoUrl: "https://unsplash.com/photos/hjwKMkehBco",
    alt: "black and silver fountain pen",
  },
  reporting: {
    slot: "reporting",
    photoId: "hpjSkU2UYSU",
    photographer: "Carlos Muza",
    photographerUrl: "https://unsplash.com/@kmuza",
    photoUrl: "https://unsplash.com/photos/hpjSkU2UYSU",
    alt: "laptop computer on glass-top table",
  },
} as const;

export function getRoiPhotoCredit(slot: string): RoiPhotoCredit | undefined {
  return ROI_PHOTO_CREDITS[slot];
}
