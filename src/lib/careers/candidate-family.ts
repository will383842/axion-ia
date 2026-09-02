import type { CrmCandidateFamily } from "@/server/crm-sync/types";

import { isVideoFamilyOffer } from "./video-editor-offer";

/**
 * FAMILLE de métiers d'une candidature — liste FERMÉE côté CRM
 * (`Taxonomy::CANDIDATE_RELATION_TYPES`), décision actée le 2026-08-13 :
 * la granularité est la FAMILLE, pas l'offre. L'offre précise vit dans le tag
 * `cand-offre:<slug>`, qui lui n'a pas besoin de migration pour évoluer.
 *
 * Ajouter une famille ici sans l'ajouter au CHECK SQL du CRM ferait REFUSER
 * toutes les candidatures concernées : les deux listes doivent bouger ensemble.
 *
 * 🔴 Corrigé le 2026-09-02. La règle était « catégorie `design` → `candidat_video` ».
 * Elle rangeait le candidat UX/UI en « vidéo », pendant que le vidéaste et le
 * créateur UGC — catégorie `marketing` — tombaient en « autre ». Le tri était
 * inversé pour les deux profils les plus vidéo du catalogue. La famille vidéo se
 * lit désormais sur l'offre elle-même (`VIDEO_FAMILY_OFFER_SLUGS`), pas sur une
 * catégorie qui ne l'a jamais décrite.
 */
export function candidateFamilyForOffer(
  offerSlug: string | null | undefined,
  category: string | null | undefined,
): CrmCandidateFamily {
  if (isVideoFamilyOffer(offerSlug)) return "candidat_video";

  switch (category) {
    case "commercial":
      return "candidat_commercial";
    case "developpement":
    case "ia":
    case "data":
      return "candidat_tech";
    case "design":
      // Ce qui reste en `design` une fois la création audiovisuelle sortie, c'est
      // le design produit (UX/UI) : plus proche de l'équipe produit que du fourre-tout.
      return "candidat_tech";
    default:
      return "candidat_autre";
  }
}
