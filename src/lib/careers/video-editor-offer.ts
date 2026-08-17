// SSOT — offre « Monteur vidéo freelance (derush et montage) ».
//
// Demande Will 2026-08-12 : les candidatures à CETTE offre doivent vivre
// séparées des autres (salon Telegram dédié, doublon WhatsApp, vue console à
// part). Tout le tri par offre passe par ce slug — une seule constante à
// changer si l'offre est un jour re-sluggée en console.

export const VIDEO_EDITOR_OFFER_SLUG = "monteur-video-freelance-distance";

/** Vrai si le slug est celui de l'offre monteur vidéo freelance. */
export function isVideoEditorOffer(offerSlug: string | null | undefined): boolean {
  return offerSlug === VIDEO_EDITOR_OFFER_SLUG;
}
