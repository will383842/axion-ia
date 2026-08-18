/**
 * SSOT — Photos Unsplash de /memo-isere et /devenir-commercial-ia/candidature.
 *
 * AUTO-GÉNÉRÉ par `scripts/curate-memo-isere-unsplash.mjs --build`.
 * Photos servies en LOCAL (`public/illustrations/memo-isere/*.avif`) → 0 hotlink,
 * indexables Google Images sous notre domaine (cf. `src/lib/seo/page-images.ts`).
 *
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe RENDUE sur la page (§9) via <UnsplashCredit>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 *
 * Le champ `alt` est RÉDIGÉ à la main côté page (l'alt Unsplash est en anglais
 * et décrit la photo, pas son rôle éditorial) — ici on ne garde que le crédit.
 */

export interface MemoIserePhoto {
  readonly slot: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
}

export const MEMO_ISERE_PHOTOS = {
  hero: {
    slot: "hero",
    src: "/illustrations/memo-isere/commercial-independant-ia-rendez-vous-dirigeant-pme-axion-ia.avif",
    width: 1600,
    height: 1200,
    photographer: "Amy Hirschi",
    photographerUrl: "https://unsplash.com/@amyhirschi",
    photoUrl: "https://unsplash.com/photos/K0c8ko3e6AA",
  },
  territoire: {
    slot: "territoire",
    src: "/illustrations/memo-isere/territoire-corridor-grenoble-lyon-valence-die-axion-ia.avif",
    width: 1600,
    height: 900,
    photographer: "Philipp Raifer",
    photographerUrl: "https://unsplash.com/@philippraifer",
    photoUrl: "https://unsplash.com/photos/rf7kX_6wxyw",
  },
  terrain: {
    slot: "terrain",
    src: "/illustrations/memo-isere/formation-ia-entreprise-presentation-equipe-axion-ia.avif",
    width: 1600,
    height: 900,
    photographer: "Austin Distel",
    photographerUrl: "https://unsplash.com/@austindistel",
    photoUrl: "https://unsplash.com/photos/wD1LRb9OeEo",
  },
  equipe: {
    slot: "equipe",
    src: "/illustrations/memo-isere/accompagnement-demarrage-commercial-equipe-axion-ia.avif",
    width: 1600,
    height: 900,
    photographer: "Sable Flow",
    photographerUrl: "https://unsplash.com/@sableflow",
    photoUrl: "https://unsplash.com/photos/KHpjeuaWOec",
  },
  "secteur-industrie": {
    slot: "secteur-industrie",
    src: "/illustrations/memo-isere/clients-industrie-site-production-axion-ia.avif",
    width: 1200,
    height: 900,
    photographer: "Pickawood",
    photographerUrl: "https://unsplash.com/@pickawood",
    photoUrl: "https://unsplash.com/photos/_l9Znw_mxgs",
  },
  "secteur-tertiaire": {
    slot: "secteur-tertiaire",
    src: "/illustrations/memo-isere/clients-tertiaire-siege-services-b2b-axion-ia.avif",
    width: 1200,
    height: 900,
    photographer: "Campaign Creators",
    photographerUrl: "https://unsplash.com/@campaign_creators",
    photoUrl: "https://unsplash.com/photos/e6n7uoEnYbA",
  },
  "secteur-commerce": {
    slot: "secteur-commerce",
    src: "/illustrations/memo-isere/clients-commerce-artisan-tpe-locale-axion-ia.avif",
    width: 1200,
    height: 900,
    photographer: "Blake Wisz",
    photographerUrl: "https://unsplash.com/@blakewisz",
    photoUrl: "https://unsplash.com/photos/Kx3o6_m1Yv8",
  },
  candidature: {
    slot: "candidature",
    src: "/illustrations/memo-isere/candidature-commercial-ia-sans-cv-mobile-axion-ia.avif",
    width: 1400,
    height: 1050,
    photographer: "Charis Gegelman",
    photographerUrl: "https://unsplash.com/@charisatkinhousemade",
    photoUrl: "https://unsplash.com/photos/oVj742JJHPo",
  },
} as const satisfies Record<string, MemoIserePhoto>;

export type MemoIserePhotoSlot = keyof typeof MEMO_ISERE_PHOTOS;

export function memoPhoto(slot: MemoIserePhotoSlot): MemoIserePhoto {
  return MEMO_ISERE_PHOTOS[slot];
}
