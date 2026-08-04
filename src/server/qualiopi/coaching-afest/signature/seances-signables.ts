/**
 * AFEST 1-to-1 — Quelles séances peut-on signer, MAINTENANT ?
 *
 * ## Pourquoi ce module existe — le trou que le collectif n'avait pas
 *
 * Le chemin collectif interdit la signature à l'avance et « à la chaîne » via
 * `creneaux-signables.ts` : on n'offre que les demi-journées COMMENCÉES, et la
 * fenêtre de 48 h ne sert qu'à rattraper un créneau passé quand le réseau a
 * lâché. `CAA Nantes 20/04/2021` sanctionne précisément les signatures à la
 * chaîne et les signatures apposées à des dates impossibles.
 *
 * L'AFEST n'avait AUCUN équivalent. Sa seule borne était l'expiration du jeton,
 * soit « fin de session + 48 h » — or un parcours de coaching dure 6, 12 ou
 * 24 mois. Conséquence concrète : **douze séances back-signables d'un coup le
 * dernier jour**, avec de vraies images, de vrais hachages et une chaîne
 * parfaitement valide, à des dates de séance vieilles de plusieurs mois. Une
 * preuve techniquement irréprochable d'un fait qui n'a pas eu lieu ainsi.
 *
 * Afficher l'écart `signeAt ↔ seanceDate` sur le PDF est une mitigation utile,
 * mais elle ne guérit pas le vice : elle le documente.
 *
 * La règle retenue est donc celle du collectif, transposée AU GRAIN DE LA
 * SÉANCE : commencée, et pas plus vieille que sa propre fenêtre de rattrapage.
 * L'expiration du jeton reste un plafond SECONDAIRE, jamais le seul.
 *
 * ⚠️ Cette garde vit dans le SERVICE, pas seulement dans l'écran : elle doit
 * valoir pour les trois porteurs (lien bénéficiaire, poste formateur, lien
 * tuteur), et une garde qui n'existe que côté client n'est pas une garde.
 *
 * Logique pure — aucun import Prisma. L'instant courant est un PARAMÈTRE, jamais
 * `new Date()` : c'est ce qui rend ce module testable sans geler l'horloge.
 */

import { parisDateISO, parisMinutesDuJour } from "@/server/qualiopi/presence/time";

/**
 * Fenêtre de rattrapage APRÈS la fin d'une séance.
 *
 * Alignée sur la décision D13 du collectif (48 h), mais bornée à la SÉANCE et
 * non au parcours — c'est toute la différence entre « rattraper une séance
 * d'hier » et « signer douze séances de l'année écoulée ».
 */
export const FENETRE_RATTRAPAGE_SEANCE_MS = 48 * 60 * 60 * 1000;

/** Statut d'une séance, miroir de l'enum DB `coaching_seance_statut`. */
export type StatutSeance = "planifiee" | "realisee" | "annulee" | "absence_justifiee";

/** Une séance telle que présentée au signataire. */
export interface SeanceCandidate {
  id: string;
  /** Instant de DÉBUT de la séance (`CompteRenduSeance.dateSeance`). */
  debut: Date;
  /** Durée réellement réalisée. `null` = non renseignée → pas d'horaires. */
  dureeMinutes: number | null;
  statut: StatutSeance;
  /** Vrai si une signature non révoquée existe déjà pour ce (séance, rôle). */
  dejaSigne: boolean;
}

export type MotifNonSignable =
  | "seance_neutralisee"
  | "horaires_indeterminables"
  | "seance_non_commencee"
  | "seance_trop_ancienne"
  | "deja_signe";

export type EtatSeance =
  { id: string; signable: true } | { id: string; signable: false; motif: MotifNonSignable };

/** Horaires réels d'une séance, prêts à être scellés. */
export interface HorairesSeance {
  /** Jour civil `YYYY-MM-DD` en heure de PARIS. */
  jourParis: string;
  heureDebut: string;
  heureFin: string;
}

function hhmm(minutesDuJour: number): string {
  const h = Math.floor(minutesDuJour / 60);
  const m = minutesDuJour % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Horaires RÉELS d'une séance, ou `null` s'ils ne sont pas déterminables.
 *
 * 🔴 Source non ambiguë, AU GRAIN DE LA SÉANCE : début =
 * `CompteRenduSeance.dateSeance`, fin = début + `dureeMinutes`. Les deux
 * ramenés en heure de Paris.
 *
 * ⚠️ NE JAMAIS dériver ces horaires de `CoachingSession.dateSeanceFin` : c'est
 * le PARENT, qui agrège N séances. Toutes les séances d'un parcours en
 * sortiraient avec les mêmes horaires, faux, et scellés pour cinq ans.
 *
 * Retourne `null` — donc un refus applicatif, jamais une invention — quand :
 *   · la durée n'est pas renseignée ou n'est pas positive (le
 *     « 09h00–17h00 » par défaut est exactement ce que ce chantier supprime) ;
 *   · la séance déborde sur un autre jour civil de Paris, ou traverse un
 *     changement d'heure de façon à rendre `heureFin <= heureDebut`. Les
 *     colonnes sont bornées `HH:MM` et le CHECK SQL exige `fin > début` : mieux
 *     vaut refuser que produire une ligne que la base rejettera, ou pire, une
 *     ligne acceptée dont les horaires mentent.
 */
export function horairesSeance(debut: Date, dureeMinutes: number | null): HorairesSeance | null {
  if (dureeMinutes === null || !Number.isFinite(dureeMinutes) || dureeMinutes <= 0) return null;

  const fin = new Date(debut.getTime() + dureeMinutes * 60_000);
  const jourParis = parisDateISO(debut);
  if (parisDateISO(fin) !== jourParis) return null;

  const debutMin = parisMinutesDuJour(debut);
  const finMin = parisMinutesDuJour(fin);
  if (finMin <= debutMin) return null;

  return { jourParis, heureDebut: hhmm(debutMin), heureFin: hhmm(finMin) };
}

/** Instant de fin d'une séance, ou `null` si la durée manque. */
export function finSeance(debut: Date, dureeMinutes: number | null): Date | null {
  if (dureeMinutes === null || !Number.isFinite(dureeMinutes) || dureeMinutes <= 0) return null;
  return new Date(debut.getTime() + dureeMinutes * 60_000);
}

/**
 * État d'une séance à un instant donné.
 *
 * Retourne un MOTIF plutôt qu'un booléen : « pas encore commencée » est une
 * information utile — le signataire saura qu'il devra revenir — là où une séance
 * simplement absente de l'écran passerait pour un bug.
 *
 * L'ordre des tests n'est pas indifférent : une séance déjà signée le reste,
 * même rouverte des mois plus tard, et annoncer « trop ancienne » sur une
 * signature déjà apposée serait absurde.
 */
export function etatSeance(seance: SeanceCandidate, maintenant: Date): EtatSeance {
  if (seance.dejaSigne) return { id: seance.id, signable: false, motif: "deja_signe" };

  // Une séance annulée ou non tenue ne s'émarge pas — et ne doit pas non plus
  // bloquer l'attestation à vie : elle est NEUTRALISÉE, pas en attente.
  if (seance.statut === "annulee" || seance.statut === "absence_justifiee") {
    return { id: seance.id, signable: false, motif: "seance_neutralisee" };
  }

  const fin = finSeance(seance.debut, seance.dureeMinutes);
  if (fin === null || horairesSeance(seance.debut, seance.dureeMinutes) === null) {
    return { id: seance.id, signable: false, motif: "horaires_indeterminables" };
  }

  if (maintenant.getTime() < seance.debut.getTime()) {
    return { id: seance.id, signable: false, motif: "seance_non_commencee" };
  }

  if (maintenant.getTime() > fin.getTime() + FENETRE_RATTRAPAGE_SEANCE_MS) {
    return { id: seance.id, signable: false, motif: "seance_trop_ancienne" };
  }

  return { id: seance.id, signable: true };
}

/** État de chaque séance candidate, dans l'ordre reçu. */
export function etatsSeances(seances: SeanceCandidate[], maintenant: Date): EtatSeance[] {
  return seances.map((s) => etatSeance(s, maintenant));
}

/** Identifiants des séances réellement signables à cet instant. */
export function seancesSignables(seances: SeanceCandidate[], maintenant: Date): string[] {
  return etatsSeances(seances, maintenant)
    .filter((e): e is { id: string; signable: true } => e.signable)
    .map((e) => e.id);
}
