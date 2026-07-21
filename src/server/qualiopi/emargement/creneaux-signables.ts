/**
 * Qualiopi T13 — Quelles demi-journées un stagiaire peut-il signer, MAINTENANT ?
 *
 * ## Pourquoi ce filtre existe
 *
 * Le jeton reste valable jusqu'à la fin de session + 48 h (décision D13). Sans
 * filtre, un stagiaire pourrait donc signer ses six demi-journées d'un coup le
 * dernier jour — voire signer d'avance une demi-journée qu'il n'a pas encore
 * suivie. Or `CAA Nantes 20/04/2021` sanctionne précisément les « signatures à
 * la chaîne », au même titre que les signatures apposées à des dates
 * impossibles.
 *
 * La règle retenue : **on n'offre que les demi-journées COMMENCÉES**. Signer à
 * l'avance devient impossible ; la fenêtre de 48 h ne sert plus qu'à ce pour
 * quoi elle a été voulue — rattraper un créneau passé quand le réseau a lâché
 * ou le téléphone s'est éteint.
 *
 * Ça ne coûte rien au stagiaire de bonne foi : il signe la matinée à la fin de
 * la matinée, exactement comme sur une feuille papier.
 *
 * Logique pure — aucun import Prisma. L'instant courant est un PARAMÈTRE, jamais
 * `new Date()` : c'est ce qui rend ce module testable sans geler l'horloge.
 */

import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import { parisDateISO, parisMinutesDuJour } from "@/server/qualiopi/presence/time";
import { fenetreDemiJournee } from "@/server/qualiopi/presence/repartition-distanciel";

/** Un créneau tel que présenté au stagiaire. */
export interface CreneauCandidat {
  id: string;
  /** Jour civil ISO `YYYY-MM-DD` (heure de Paris). */
  date: string;
  demiJournee: DemiJourneeLabel;
  /** Horaires RÉELS de la journée déclarée. */
  jourHeureDebut: string;
  jourHeureFin: string;
  /** Vrai si une signature non révoquée existe déjà pour ce créneau. */
  dejaSigne: boolean;
}

export type MotifNonSignable = "pas_encore_commence" | "deja_signe";

export type EtatCreneau =
  | { id: string; signable: true }
  | { id: string; signable: false; motif: MotifNonSignable };

/**
 * Vrai si la demi-journée a commencé, à l'instant donné, en heure de Paris.
 *
 * La comparaison se fait EN HEURE DE PARIS des deux côtés : la date et les
 * horaires du créneau sont déclarés en heure de Paris, l'instant courant est un
 * `Date` UTC. Comparer sans convertir décalerait la bascule d'une à deux heures
 * selon la saison — et rendrait une matinée signable dès 07 h en été.
 */
export function demiJourneeCommencee(
  creneau: Pick<CreneauCandidat, "date" | "demiJournee" | "jourHeureDebut" | "jourHeureFin">,
  maintenant: Date,
): boolean {
  const jourCourant = parisDateISO(maintenant);
  if (jourCourant > creneau.date) return true;
  if (jourCourant < creneau.date) return false;

  const { debutMin } = fenetreDemiJournee(
    creneau.jourHeureDebut,
    creneau.jourHeureFin,
    creneau.demiJournee,
  );
  return parisMinutesDuJour(maintenant) >= debutMin;
}

/**
 * État de chaque créneau candidat, dans l'ordre reçu.
 *
 * Retourne un MOTIF plutôt qu'un simple booléen : « pas encore commencé » est
 * une information utile au stagiaire — il saura qu'il devra revenir — là où un
 * créneau simplement absent de l'écran passerait pour un bug.
 */
export function etatsCreneaux(creneaux: CreneauCandidat[], maintenant: Date): EtatCreneau[] {
  return creneaux.map((c) => {
    // L'ordre compte : un créneau déjà signé le reste, même si l'on rouvre la
    // page le lendemain. Annoncer « pas encore commencé » sur une signature déjà
    // apposée serait absurde.
    if (c.dejaSigne) return { id: c.id, signable: false, motif: "deja_signe" };
    if (!demiJourneeCommencee(c, maintenant)) {
      return { id: c.id, signable: false, motif: "pas_encore_commence" };
    }
    return { id: c.id, signable: true };
  });
}

/** Identifiants des créneaux réellement signables à cet instant. */
export function creneauxSignables(creneaux: CreneauCandidat[], maintenant: Date): string[] {
  return etatsCreneaux(creneaux, maintenant)
    .filter((e): e is { id: string; signable: true } => e.signable)
    .map((e) => e.id);
}
