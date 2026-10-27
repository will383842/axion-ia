/**
 * Tour France IA : rapprocher une demande d'un rendez-vous pris (PR-2a).
 *
 * « Rendez-vous pris » n'est JAMAIS stocké sur la demande : il se calcule à la lecture, en
 * comparant l'empreinte de l'e-mail de la demande à celles des rendez-vous Calendly du Tour
 * (`hashEmailForLookup(inviteeEmail)`). Aucune colonne sur `calendly_events`, rien dans le webhook ni
 * dans le worker : le rapprochement se corrige tout seul si un rendez-vous est annulé ou déplacé.
 *
 * Module PUR.
 */

import { estStatutDemande, type StatutAffiche } from "./types";

export interface DemandeARapprocher {
  /** Le statut stocké (`recue`, `relancee_main`, `ecartee`, `effacee_rgpd`). */
  readonly statut: string;
  readonly emailHash: string | null;
}

/**
 * Le statut à afficher. Un rendez-vous pris l'emporte sur « demande reçue » et sur « relancée à la
 * main » ; il ne ressuscite jamais une demande écartée ni une demande effacée. Un statut stocké
 * inconnu vaut « demande reçue ». PUR.
 */
export function statutAffiche(
  demande: DemandeARapprocher,
  empreintesDesRendezVous: ReadonlySet<string>,
): StatutAffiche {
  const stocke = estStatutDemande(demande.statut) ? demande.statut : "recue";
  if (stocke === "ecartee" || stocke === "effacee_rgpd") return stocke;
  if (demande.emailHash !== null && empreintesDesRendezVous.has(demande.emailHash)) {
    return "rdv_pris";
  }
  return stocke;
}
