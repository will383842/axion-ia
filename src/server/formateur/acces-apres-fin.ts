/**
 * Espace formateur — quel ACCÈS une fiche peut-elle ouvrir ? (lot E, M14)
 *
 *  - « complet » : fiche active, collaboration non close (le cas d'avant ce lot) ;
 *  - « lecture » : formateur INDÉPENDANT dont la collaboration est close, interrupteur
 *    `formateurs.fin_collaboration` allumé — honoraires et dossier, en lecture ;
 *  - `null` : aucun accès (salarié désactivé, interrupteur coupé…).
 *
 * Lu par la demande de lien de connexion, par la consommation du lien et par la garde
 * de session : une seule règle, aux trois portes.
 */

import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";

export type AccesFormateur = "complet" | "lecture";

export async function accesFormateur(t: {
  readonly actif: boolean;
  readonly statut: string;
  readonly finCollaborationAt: Date | null | undefined;
}): Promise<AccesFormateur | null> {
  if (t.actif && t.finCollaborationAt == null) return "complet";
  if (t.statut !== "sous_traitant" || t.finCollaborationAt == null) return null;
  return (await interrupteurAllume("fin_collaboration")) ? "lecture" : null;
}

// Version de session de l'espace : pure, logée côté Qualiopi pour que le jeton de
// mission (`mission-formateur.ts`) la lise sans dépendre de l'espace.
export {
  ecritureFormateurPermise,
  empreinteSessionFormateur,
  versionSessionFormateur,
} from "@/server/qualiopi/formateurs-independants/version-session";
