// SSOT — offres vidéo / création audiovisuelle.
//
// Demande Will 2026-08-12 : les candidatures à l'offre « Monteur vidéo freelance »
// doivent vivre séparées des autres (salon Telegram dédié, doublon WhatsApp, vue
// console à part). Tout le tri par offre passe par ce slug — une seule constante
// à changer si l'offre est un jour re-sluggée en console.

export const VIDEO_EDITOR_OFFER_SLUG = "monteur-video-freelance-distance";

/** Vrai si le slug est celui de l'offre monteur vidéo freelance. */
export function isVideoEditorOffer(offerSlug: string | null | undefined): boolean {
  return offerSlug === VIDEO_EDITOR_OFFER_SLUG;
}

/**
 * Offres dont les candidats relèvent de la famille CRM « vidéo » (création et
 * production audiovisuelle).
 *
 * 🔴 Pourquoi une liste explicite et pas une règle sur la catégorie : aucune
 * donnée portée par l'offre ne découpe correctement ce périmètre.
 *  - `category === "design"` y ferait entrer `designer-ux-ui` (c'était le bug :
 *    un candidat UX/UI classé « vidéo », et pendant ce temps le vidéaste et le
 *    créateur UGC classés « autre »).
 *  - `group === "media"` du seed y ferait entrer le community manager, les
 *    relations presse et les partenariats — et n'existe pas en base de toute façon.
 *
 * La liste est tenue honnête par `candidate-family.spec.ts`, qui la confronte à
 * `careers_seed_input.json` : un slug mort la fait rougir, et toute nouvelle
 * offre de catégorie `design` doit être classée ici ou dans la liste des
 * exceptions — le test refuse de deviner à notre place.
 */
export const VIDEO_FAMILY_OFFER_SLUGS: ReadonlySet<string> = new Set([
  VIDEO_EDITOR_OFFER_SLUG,
  "monteur-video-motion",
  "monteur-son-podcast",
  "videaste-content-creator",
  "createur-ugc-reels",
  "producteur-podcast",
  "photographe-crea",
]);

/**
 * Offres de catégorie `design` qui ne sont PAS de la création audiovisuelle.
 * Sert uniquement à la garde : elle exige que chaque offre `design` soit
 * rangée d'un côté ou de l'autre, jamais laissée au hasard d'un défaut.
 */
export const NON_VIDEO_DESIGN_OFFER_SLUGS: ReadonlySet<string> = new Set(["designer-ux-ui"]);

/** Vrai si les candidatures à cette offre relèvent de la famille « vidéo ». */
export function isVideoFamilyOffer(offerSlug: string | null | undefined): boolean {
  return offerSlug != null && VIDEO_FAMILY_OFFER_SLUGS.has(offerSlug);
}
