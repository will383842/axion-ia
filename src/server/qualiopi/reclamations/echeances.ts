/**
 * L09 — les échéances d'une réclamation (indicateur 31), en fonctions PURES.
 *
 * La procédure publiée engage l'organisme sur deux délais, comptés en JOURS
 * OUVRÉS au calendrier de Paris (lundi-vendredi, hors jours fériés de
 * métropole — `@/lib/jours-ouvres`) :
 *   - l'ACCUSÉ DE RÉCEPTION sous 5 jours ouvrés au plus — en pratique il part
 *     automatiquement, à l'instant du dépôt ;
 *   - la RÉPONSE ÉCRITE, signée par l'organisme, sous 15 jours ouvrés.
 * Un réexamen rouvre une échéance de réponse de 15 jours ouvrés, comptée
 * depuis le réexamen.
 *
 * Les dates d'entrée sont des dates SERVEUR ; le « jour » d'une date est
 * toujours celui de Paris.
 */

import { ajouterJoursOuvres, estJourCivilOuvre } from "@/lib/jours-ouvres";

export const DELAI_ACCUSE_JOURS_OUVRES = 5;
export const DELAI_REPONSE_JOURS_OUVRES = 15;
/** En deçà (inclus) de ce nombre de jours ouvrés restants, l'échéance est « proche ». */
export const SEUIL_ECHEANCE_PROCHE = 3;

const JOUR_PARIS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATE_LISIBLE_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** « 6 novembre 2026 », au calendrier de Paris. */
export function dateLisibleParis(d: Date): string {
  return DATE_LISIBLE_PARIS.format(d);
}

/** Le jour civil « AAAA-MM-JJ » de Paris pour une date serveur. */
export function jourParis(d: Date): string {
  return JOUR_PARIS.format(d);
}

function jourSuivant(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Jours ouvrés restants avant l'échéance (le jour de l'échéance compte, le jour
 * en cours non). 0 = c'est le dernier jour ; négatif = jours ouvrés de retard.
 */
export function joursOuvresRestants(maintenant: Date, echeance: Date): number {
  const aujourdhui = jourParis(maintenant);
  const fin = jourParis(echeance);
  if (aujourdhui === fin) return 0;
  const avance = aujourdhui < fin;
  const a = avance ? fin : aujourdhui;
  let de = avance ? aujourdhui : fin;
  let n = 0;
  // Borne de sûreté : une année de jours ouvrés suffit largement.
  for (let i = 0; i < 400 && de < a; i += 1) {
    de = jourSuivant(de);
    if (estJourCivilOuvre(de)) n += 1;
  }
  return avance ? n : -n;
}

export interface Echeances {
  readonly accuseAvant: Date;
  readonly reponseAvant: Date;
}

export function echeancesReclamation(dateReception: Date): Echeances {
  return {
    accuseAvant: ajouterJoursOuvres(dateReception, DELAI_ACCUSE_JOURS_OUVRES),
    reponseAvant: ajouterJoursOuvres(dateReception, DELAI_REPONSE_JOURS_OUVRES),
  };
}

export type EtatEcheance = "fait" | "dans_les_temps" | "proche" | "depassee";

export type EtapeCode = "reception" | "accuse" | "analyse" | "reponse" | "reexamen" | "cloture";

export interface EtapeDatee {
  readonly etape: EtapeCode;
  /** Date serveur de l'étape. Requise pour un réexamen (elle fonde la nouvelle échéance). */
  readonly creeLe?: Date;
}

export interface EtatDesEcheances {
  readonly accuse: EtatEcheance;
  readonly reponse: EtatEcheance;
  readonly accuseAvant: Date;
  readonly reponseAvant: Date;
  /** Jours ouvrés restants avant la réponse (négatif = retard) ; `null` si la réponse est faite. */
  readonly joursRestantsReponse: number | null;
}

function etat(maintenant: Date, echeance: Date): EtatEcheance {
  const restants = joursOuvresRestants(maintenant, echeance);
  if (restants < 0) return "depassee";
  return restants <= SEUIL_ECHEANCE_PROCHE ? "proche" : "dans_les_temps";
}

/**
 * Pure : où en sont les deux échéances ? Les étapes sont données dans l'ordre
 * chronologique (celui du journal `reclamation_etapes`).
 */
export function etatEcheances(
  dateReception: Date,
  etapes: ReadonlyArray<EtapeDatee>,
  maintenant: Date,
): EtatDesEcheances {
  const base = echeancesReclamation(dateReception);

  const accuseFait = etapes.some((e) => e.etape === "accuse");

  let indexReexamen = -1;
  etapes.forEach((e, i) => {
    if (e.etape === "reexamen") indexReexamen = i;
  });
  const reexamen = indexReexamen >= 0 ? etapes[indexReexamen] : undefined;
  const reponseAvant =
    reexamen?.creeLe !== undefined
      ? ajouterJoursOuvres(reexamen.creeLe, DELAI_REPONSE_JOURS_OUVRES)
      : base.reponseAvant;
  const reponseFaite = etapes.slice(indexReexamen + 1).some((e) => e.etape === "reponse");

  return {
    accuse: accuseFait ? "fait" : etat(maintenant, base.accuseAvant),
    reponse: reponseFaite ? "fait" : etat(maintenant, reponseAvant),
    accuseAvant: base.accuseAvant,
    reponseAvant,
    joursRestantsReponse: reponseFaite ? null : joursOuvresRestants(maintenant, reponseAvant),
  };
}
