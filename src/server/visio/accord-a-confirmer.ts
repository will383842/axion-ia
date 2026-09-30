/**
 * G16 — « ACCORD D'UNE PERSONNE NON RETROUVÉ » : le signal posé sur le compte
 * rendu, et la confirmation à la main de Will (plan §3.12, règle d'effet du
 * champ `consentement` ; fiche PR 6 « deux voix client = deux accords »).
 *
 * `precontroler` retrouve dans la transcription la réponse de chaque voix de
 * la piste client à l'annonce de l'enregistrement. Quand il en retrouve MOINS
 * que de voix client (ou aucune), il pose le signal dans le journal technique
 * de l'enregistrement (`Enregistrement.evenements`, type court, sans parole).
 * Tant que Will n'a pas confirmé à la main que chaque personne a donné son
 * accord, AUCUNE validation n'est possible : ni « Valider le compte rendu »,
 * ni « Valider tous » (`exigerAccordConfirme`, gestes-compte-rendu.ts).
 *
 * L'état d'un enregistrement est le DERNIER des trois événements : un
 * précontrôle refait après une confirmation (enregistrement court relancé)
 * repose la question. Module PUR.
 */

import { lireJournal } from "./journal-enregistrement";

/** Posé par `precontroler` : une voix client (au moins) sans accord retrouvé. */
export const EVT_ACCORD_A_CONFIRMER = "accord_a_confirmer";
/** Posé par `precontroler` : autant d'accords retrouvés que de voix client. */
export const EVT_ACCORD_RETROUVE = "accord_retrouve";
/** Posé par le geste de Will « chaque personne a donné son accord ». */
export const EVT_ACCORD_CONFIRME_PAR_WILL = "accord_confirme_par_will";

const EVENEMENTS_ACCORD = new Set([
  EVT_ACCORD_A_CONFIRMER,
  EVT_ACCORD_RETROUVE,
  EVT_ACCORD_CONFIRME_PAR_WILL,
]);

/** Le précontrôle doit-il poser le signal ? (aucun accord, ou moins d'accords que de voix). */
export function signalAccordAPoser(plan: {
  readonly controleAccord: boolean;
  readonly muette: boolean;
  readonly accords: readonly unknown[];
  readonly voixSansAccord: number;
}): boolean {
  if (!plan.controleAccord || plan.muette) return false;
  return plan.accords.length === 0 || plan.voixSansAccord > 0;
}

/** Le journal d'UN enregistrement porte-t-il un signal non confirmé ? */
export function accordAConfirmer(journal: string | null | undefined): boolean {
  const derniers = lireJournal(journal).filter((e) => EVENEMENTS_ACCORD.has(e.type));
  return derniers.at(-1)?.type === EVT_ACCORD_A_CONFIRMER;
}

/** Une rencontre attend-elle la confirmation de Will (au moins un enregistrement) ? */
export function rencontreAccordAConfirmer(
  enregistrements: ReadonlyArray<{ readonly evenements: string | null }>,
): boolean {
  return enregistrements.some((e) => accordAConfirmer(e.evenements));
}
