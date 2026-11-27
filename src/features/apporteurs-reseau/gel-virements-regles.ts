/**
 * Lot 7 (plan §4.2) : règles PURES du gel des virements. Aucun accès base.
 *
 * D-4, option retenue = B (recommandation du plan) : une ligne gelée RESTE gelée tant que la demande
 * est ouverte, même après l'échéance de 30 jours (rouge, tracée). Le virement sur l'ANCIEN compte
 * n'est possible qu'après un REFUS MOTIVÉ du `super_admin` (`refuserDemande`, motif obligatoire),
 * qui lève le gel : aucune levée automatique, le geste reste humain et journalisé.
 */

import { echeancePaiement, jourParis } from "./autofacture-donnees";
import { ALERTE_ECHEANCE_JOURS, type StatutChangementIban } from "./changement-iban-regles";

export const MESSAGE_GEL = "Virements gelés : changement de compte en cours";

export interface LigneGelee {
  readonly emissionAt: Date;
  readonly paiementIntegralAt?: Date | null;
}

export interface EtatGel {
  readonly statut: StatutChangementIban;
  /** La plus proche échéance de 30 jours parmi les lignes gelées : une DATE, jamais un compte à rebours. */
  readonly plusProcheEcheance: Date;
  /** Rouge : échéance à 5 jours ou moins, ou dépassée. */
  readonly rouge: boolean;
}

/** Jours de Paris entre `maintenant` et l'échéance (négatif une fois dépassée). */
export function joursRestants(echeance: Date, maintenant: Date): number {
  const a = new Date(`${jourParis(maintenant)}T00:00:00Z`).getTime();
  const b = new Date(`${jourParis(echeance)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function echeanceEnAlerte(echeance: Date, maintenant: Date): boolean {
  return joursRestants(echeance, maintenant) <= ALERTE_ECHEANCE_JOURS;
}

export function etatGelDesLignes(
  demande: { statut: StatutChangementIban },
  lignes: ReadonlyArray<LigneGelee>,
  maintenant: Date,
): EtatGel | null {
  if (lignes.length === 0) return null;
  const echeances = lignes.map((l) => echeancePaiement(l.emissionAt, l.paiementIntegralAt ?? null));
  const plus = echeances.reduce((a, b) => (b.getTime() < a.getTime() ? b : a));
  return {
    statut: demande.statut,
    plusProcheEcheance: plus,
    rouge: echeanceEnAlerte(plus, maintenant),
  };
}
