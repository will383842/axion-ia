/**
 * Qualiopi — Où et comment la date de l'accord écrit s'écrit (module PUR, lot
 * OPCO A7b, manque n°9).
 *
 * La date ÉCRITE sur l'accord de l'OPCO gouverne le régime de paiement
 * (`regime-paiement-session.ts`). Elle ne se saisissait qu'au Hub facturation,
 * au passage en « accord reçu ». La page Financement la saisit désormais à côté
 * du dépôt ; ce module dit quel geste cela représente selon le statut :
 *
 *  • accord déjà acté (accord reçu, facturé, payé) → la date seule ;
 *  • demande envoyée → l'accord est acté, avec sa date ;
 *  • dossier « à monter » dont le DÉPÔT est saisi → l'envoi est constaté (le
 *    dépôt le prouve), puis l'accord ;
 *  • sinon → refus qui dit quoi faire.
 *
 * Aucun import Prisma : testable seul.
 */

import type { DossierFinancementStatut } from "../../../../prisma/generated/client";

export type PlanAccordEcrit =
  | { geste: "date_seule" }
  | { geste: "transitions"; vers: DossierFinancementStatut[] }
  | { geste: "refus"; message: string };

export function planAccordEcrit(dossier: {
  statut: DossierFinancementStatut;
  depotFaitLe: Date | null;
}): PlanAccordEcrit {
  switch (dossier.statut) {
    case "accord_recu":
    case "facture":
    case "paiement_recu":
      return { geste: "date_seule" };
    case "envoye":
      return { geste: "transitions", vers: ["accord_recu"] };
    case "a_monter":
      return dossier.depotFaitLe !== null
        ? { geste: "transitions", vers: ["envoye", "accord_recu"] }
        : {
            geste: "refus",
            message: "Saisissez d'abord la date du dépôt de la demande, puis celle de l'accord.",
          };
    case "refuse":
      return {
        geste: "refus",
        message: "Dossier refusé par l'OPCO : renvoyez la demande depuis le Hub facturation.",
      };
    case "clos":
      return { geste: "refus", message: "Dossier clos : l'accord ne se saisit plus." };
  }
}
