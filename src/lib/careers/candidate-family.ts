import type { CrmCandidateFamily } from "@/server/crm-sync/types";

import { isVideoEditorOffer } from "./video-editor-offer";

/**
 * FAMILLE de métiers d'une candidature — liste FERMÉE côté CRM
 * (`Taxonomy::CANDIDATE_RELATION_TYPES`), décision actée le 2026-08-13 :
 * la granularité est la FAMILLE, pas l'offre. L'offre précise vit dans le tag
 * `cand-offre:<slug>`, qui lui n'a pas besoin de migration pour évoluer.
 *
 * Ajouter une famille ici sans l'ajouter au CHECK SQL du CRM ferait REFUSER
 * toutes les candidatures concernées : les deux listes doivent bouger ensemble.
 */
export function candidateFamilyForOffer(
  offerSlug: string | null | undefined,
  category: string | null | undefined,
): CrmCandidateFamily {
  if (isVideoEditorOffer(offerSlug)) return "candidat_video";

  switch (category) {
    case "commercial":
      return "candidat_commercial";
    case "developpement":
    case "ia":
    case "data":
      return "candidat_tech";
    case "design":
      // Le design couvre le montage vidéo et le motion : plus proche de la
      // famille « vidéo » que de « tech », et surtout jamais « commercial ».
      return "candidat_video";
    default:
      return "candidat_autre";
  }
}
