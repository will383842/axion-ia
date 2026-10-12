// Le point après un ÉCHANGE FORMATEUR, dans la tuile « à faire le point » (lot B, M17).
//
// Quel formulaire porte la carte :
//   · apporteur : le sien, inchangé ;
//   · échange formateur, suivi des échanges formateurs ALLUMÉ : ses 5 issues
//     (`IssueEchangeFormateurForm`), ou d'abord le rattachement manuel à sa candidature
//     quand il n'est rattaché à aucune ;
//   · tout le reste (et l'échange formateur tant que le suivi est coupé, comme avant) :
//     le formulaire commun.
//
// Module pur.

import type { TypeRendezVous } from "@/server/calendly/type-rendez-vous";

export type FormulairePoint = "apporteur" | "commun" | "formateur" | "rattacher_formateur";

export function formulaireDuPoint(
  r: {
    readonly typeRendezVous: TypeRendezVous;
    readonly echangeFormateur: boolean;
    readonly rattache: boolean;
  },
  suiviFormateur: boolean,
): FormulairePoint {
  if (r.typeRendezVous === "apporteur") return "apporteur";
  if (r.echangeFormateur && suiviFormateur) return r.rattache ? "formateur" : "rattacher_formateur";
  return "commun";
}

export const MESSAGE_ECHANGE_FORMATEUR =
  "Un échange formateur se conclut par ses propres issues (Absent, Reporté, Retenu, À revoir, Non retenu), depuis sa carte ou sa fiche d'appel.";

/** Une candidature proposée pour rattacher un échange formateur (même adresse). */
export interface PropositionRattachement {
  readonly id: string;
  readonly libelle: string;
}
