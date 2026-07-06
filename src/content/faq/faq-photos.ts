/**
 * SSOT — Photos Unsplash des pages FAQ (licence gratuite).
 *
 * AUTO-GÉNÉRÉ par scripts/curate-faq-unsplash.mjs. Photos téléchargées en local
 * (`public/illustrations/faq/{slot}.avif`) → 0 hotlink externe.
 * Conformité CGU Unsplash : free-tier, download-trigger §6 déclenché à la
 * curation, attribution photographe rendue (§9) via <UnsplashCredit>.
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 *
 * `slot` = "hub" | "topics" | slug de catégorie FAQ (general, interventions,
 * implementation, audit, pricing, process, sites-web, un-a-un).
 */

export interface FaqPhotoCredit {
  readonly slot: string;
  readonly photoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly alt: string;
}

export const FAQ_PHOTO_CREDITS: Record<string, FaqPhotoCredit> = {
  hub: {
    slot: "hub",
    photoId: "qucYweSE3ZY",
    photographer: "Amr Taha™",
    photographerUrl: "https://unsplash.com/@amr_taha",
    photoUrl: "https://unsplash.com/photos/qucYweSE3ZY",
    alt: "black flat screen computer monitor on brown wooden desk",
  },
  topics: {
    slot: "topics",
    photoId: "PypjzKTUqLo",
    photographer: "Roman Bozhko",
    photographerUrl: "https://unsplash.com/@romanbozhko",
    photoUrl: "https://unsplash.com/photos/PypjzKTUqLo",
    alt: "silver iMac on brown wooden desk",
  },
  general: {
    slot: "general",
    photoId: "KdeqA3aTnBY",
    photographer: "Dylan Gillis",
    photographerUrl: "https://unsplash.com/@mainermedia",
    photoUrl: "https://unsplash.com/photos/KdeqA3aTnBY",
    alt: "people sitting on chair in front of table while holding pens during daytime",
  },
  interventions: {
    slot: "interventions",
    photoId: "gMsnXqILjp4",
    photographer: "Campaign Creators",
    photographerUrl: "https://unsplash.com/@campaign_creators",
    photoUrl: "https://unsplash.com/photos/gMsnXqILjp4",
    alt: "man standing in front of people sitting beside table with laptop computers",
  },
  implementation: {
    slot: "implementation",
    photoId: "OqtafYT5kTw",
    photographer: "Ilya Pavlov",
    photographerUrl: "https://unsplash.com/@ilyapavlov",
    photoUrl: "https://unsplash.com/photos/OqtafYT5kTw",
    alt: "monitor showing Java programming",
  },
  audit: {
    slot: "audit",
    photoId: "amLfrL8LGls",
    photographer: "Jason Briscoe",
    photographerUrl: "https://unsplash.com/@jsnbrsc",
    photoUrl: "https://unsplash.com/photos/amLfrL8LGls",
    alt: "person using MacBook Pro on table",
  },
  pricing: {
    slot: "pricing",
    photoId: "xoU52jUVUXA",
    photographer: "Kelly Sikkema",
    photographerUrl: "https://unsplash.com/@kellysikkema",
    photoUrl: "https://unsplash.com/photos/xoU52jUVUXA",
    alt: "person holding paper near pen and calculator",
  },
  process: {
    slot: "process",
    photoId: "wD1LRb9OeEo",
    photographer: "Austin Distel",
    photographerUrl: "https://unsplash.com/@austindistel",
    photoUrl: "https://unsplash.com/photos/wD1LRb9OeEo",
    alt: "three men sitting while using laptops and watching man beside whiteboard",
  },
  "sites-web": {
    slot: "sites-web",
    photoId: "LrxSl4ZxoRs",
    photographer: "Mohammad Rahmani",
    photographerUrl: "https://unsplash.com/@afgprogrammer",
    photoUrl: "https://unsplash.com/photos/LrxSl4ZxoRs",
    alt: "black samsung flat screen computer monitor",
  },
  "un-a-un": {
    slot: "un-a-un",
    photoId: "JaoVGh5aJ3E",
    photographer: "Amy Hirschi",
    photographerUrl: "https://unsplash.com/@amyhirschi",
    photoUrl: "https://unsplash.com/photos/JaoVGh5aJ3E",
    alt: "woman in teal t-shirt sitting beside woman in suit jacket",
  },
} as const;

export function getFaqPhotoCredit(slot: string): FaqPhotoCredit | undefined {
  return FAQ_PHOTO_CREDITS[slot];
}
