// État d'échéance d'une pièce du dossier société.
//
// L'état n'est JAMAIS stocké : il se recalcule à chaque lecture. Un statut en
// base laisserait une pièce affichée « à jour » le lendemain de sa péremption,
// faute d'une tâche pour le retourner — et c'est exactement l'erreur que le
// registre des pièces formateurs a pris soin d'éviter (`TrainerDocument` :
// « l'expiration n'est PAS un statut »).
//
// `maintenant` est un paramètre, pas un appel à l'horloge enfoui : sans lui, la
// fonction ne serait pas testable sur ses propres seuils.

/** Fenêtre d'alerte avant péremption, en jours. */
export const SEUIL_ALERTE_JOURS = 30;

export type EtatEcheance = "sans_echeance" | "a_jour" | "bientot" | "perimee";

export interface Echeance {
  etat: EtatEcheance;
  /** Jours restants (négatif si dépassée). `null` sans date d'expiration. */
  joursRestants: number | null;
}

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

/** Ramène un instant au jour UTC, pour comparer des dates sans heure. */
function jourUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Calcule l'état d'une pièce à une date donnée.
 *
 * Le jour de la péremption lui-même compte comme encore valide : une
 * attestation « valable jusqu'au 30 octobre » l'est le 30 octobre.
 */
export function calculerEcheance(
  dateExpiration: Date | null | undefined,
  maintenant: Date,
): Echeance {
  if (!dateExpiration) return { etat: "sans_echeance", joursRestants: null };
  const joursRestants = Math.round((jourUtc(dateExpiration) - jourUtc(maintenant)) / MS_PAR_JOUR);
  if (joursRestants < 0) return { etat: "perimee", joursRestants };
  if (joursRestants <= SEUIL_ALERTE_JOURS) return { etat: "bientot", joursRestants };
  return { etat: "a_jour", joursRestants };
}

/** Libellé FR d'un état — le texte porte l'information, jamais la couleur seule. */
export function libelleEcheance(e: Echeance): string {
  switch (e.etat) {
    case "sans_echeance":
      return "Sans échéance";
    case "perimee":
      return e.joursRestants === -1
        ? "Périmée depuis hier"
        : `Périmée depuis ${Math.abs(e.joursRestants ?? 0)} jours`;
    case "bientot":
      if (e.joursRestants === 0) return "Périme aujourd'hui";
      if (e.joursRestants === 1) return "Périme demain";
      return `Périme dans ${e.joursRestants} jours`;
    case "a_jour":
      return "À jour";
  }
}
