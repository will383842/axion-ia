/**
 * Formateurs indépendants — LA DATE LIMITE DU VIREMENT d'une facture de mission, pure.
 *
 * Décision du dirigeant (14/10/2026), « comme les apporteurs » :
 *   1. l'autofacture d'un mois n'est établie QUE quand tout est complet pour ce mois — les
 *      feuilles de présence contresignées et, pour le dernier mois de la mission, le bilan
 *      de fin de formation remis par le formateur qui le doit (le passage n'écrit le relevé
 *      qu'à ce moment : `passage-mission.ts`, `formation-complete.ts`) ;
 *   2. le virement part au plus tard 30 jours après la DATE DE CETTE AUTOFACTURE.
 * Des pièces remises en retard retardent l'autofacture, donc le paiement — qui reste
 * toujours à 30 jours au plus de la facture (art. L441-10 du code de commerce).
 *
 * Deux cas gardent une date plus proche, jamais une plus lointaine :
 *   - une autofacture qui en REMPLACE une autre (réémission après avoir, art. 16.5 du
 *     contrat-cadre) garde la date limite de la pièce qu'elle remplace ;
 *   - une pièce qui porte une somme à date fixe du contrat — l'indemnité d'annulation
 *     (art. 11.3 : 30 jours après l'annulation) ou la présentation de la méthode (art.
 *     21.2 : 30 jours après la présentation) — garde cette date si elle est plus proche.
 *
 * Aucune horloge lue ici : le jour de l'autofacture est un paramètre.
 */

import { ajouterJours, type JourCivil } from "../argent/dates";
import {
  PARAMETRES_ARGENT_FORMATEURS,
  type ParametresArgentFormateurs,
} from "../argent/parametres";

/** Objets de ligne dont le contrat fixe la date de paiement sans attendre de pièce. */
export const OBJETS_A_DATE_FIXE: ReadonlySet<string> = new Set([
  "indemnite_annulation",
  "presentation_methode",
]);

/** Midi UTC du jour civil (même convention que `instantDuJour` du passage) : le jour de Paris est le même en toute saison. */
export function instantDuJourCivil(jour: JourCivil): Date {
  return new Date(`${jour}T12:00:00Z`);
}

/** 30 jours après le jour de l'autofacture (jours civils de Paris). */
export function echeanceDepuisAutofacture(
  jourAutofacture: JourCivil,
  p: Pick<ParametresArgentFormateurs, "delaiPaiementJours"> = PARAMETRES_ARGENT_FORMATEURS,
): JourCivil {
  return ajouterJours(jourAutofacture, p.delaiPaiementJours);
}

/** La date limite à inscrire sur une autofacture de mission, le jour de son émission. */
export function echeanceAutofactureMission(
  e: {
    /** Jour (Paris) d'émission de l'autofacture. */
    readonly jourAutofacture: JourCivil;
    /** L'échéance déjà portée par le relevé (provisoire, ou héritée), ou `null`. */
    readonly echeanceDuReleve: JourCivil | null;
    /** Le relevé remplace une pièce annulée par avoir (`remplaceId`). */
    readonly remplace: boolean;
    /** Les objets de ses lignes (`animation`, `deplacement`, `indemnite_annulation`…). */
    readonly objets: ReadonlyArray<string | null>;
  },
  p: Pick<ParametresArgentFormateurs, "delaiPaiementJours"> = PARAMETRES_ARGENT_FORMATEURS,
): JourCivil {
  if (e.remplace && e.echeanceDuReleve !== null) return e.echeanceDuReleve;
  const depuisFacture = echeanceDepuisAutofacture(e.jourAutofacture, p);
  const aDateFixe = e.objets.some((o) => o !== null && OBJETS_A_DATE_FIXE.has(o));
  if (aDateFixe && e.echeanceDuReleve !== null && e.echeanceDuReleve < depuisFacture) {
    return e.echeanceDuReleve;
  }
  return depuisFacture;
}

/**
 * L'échéance PROVISOIRE posée à l'écriture d'un relevé de mission : celle qu'aurait une
 * autofacture émise le jour même (le relevé n'est écrit que quand tout est complet), et
 * jamais avant la dernière journée + 30 jours. Elle est remplacée à l'émission par
 * `echeanceAutofactureMission` ; elle sert d'ici là à la console (« à facturer »), jamais
 * de promesse au formateur.
 */
export function echeanceProvisoireDuReleve(
  e: { readonly jourEcriture: JourCivil; readonly echeanceDerniereJournee: JourCivil },
  p: Pick<ParametresArgentFormateurs, "delaiPaiementJours"> = PARAMETRES_ARGENT_FORMATEURS,
): JourCivil {
  const depuisEcriture = echeanceDepuisAutofacture(e.jourEcriture, p);
  return depuisEcriture > e.echeanceDerniereJournee ? depuisEcriture : e.echeanceDerniereJournee;
}

/**
 * Le jour de la MISSION où l'attestation URSSAF se juge (`attenteAttestationALaMission`) :
 * la dernière journée de CE formateur dans le mois du relevé. Avant cette décision, il
 * se déduisait de l'échéance (− 30 jours) ; l'échéance partant désormais de l'autofacture,
 * il se lit sur les journées. Sans journée lisible ce mois-là (indemnité seule,
 * présentation de la méthode) : le plus tôt de la fin du mois et du jour de la facture —
 * jamais une date antérieure à ce que la pièce couvre.
 */
export function derniereJourneeDuMois(e: {
  /** Les journées de CE formateur sur la session (`journeesDuFormateur`), jours civils. */
  readonly journees: ReadonlyArray<JourCivil>;
  /** « AAAA-MM » du relevé. */
  readonly mois: string;
  /** Jour (Paris) de l'autofacture, ou du calcul si elle n'est pas encore émise. */
  readonly jourRepli: JourCivil;
}): JourCivil {
  let max: JourCivil | null = null;
  for (const j of e.journees) {
    if (j.slice(0, 7) === e.mois && (max === null || j > max)) max = j;
  }
  if (max !== null) return max;
  const [a, m] = e.mois.split("-").map(Number) as [number, number];
  const finDuMois = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return finDuMois < e.jourRepli ? finDuMois : e.jourRepli;
}
