/**
 * La DICTÉE après un appel téléphonique (chantier visio, PR 7 ; décisions B5
 * et B14 : intérêt légitime, art. 6.1.f).
 *
 * Williams, seul, dicte 2 à 5 minutes au micro, sur une rencontre EXISTANTE.
 * La dictée suit le même circuit que la visio (mêmes routes, mêmes morceaux
 * chiffrés, même transcription), avec quatre différences, toutes décidées ici
 * ou par les modules qui l'importent :
 *
 *   · pas d'étape de consentement : l'enregistrement démarre `en_cours`
 *     (`sessions.ts`), et `precontroler` ne cherche aucun accord ;
 *   · chaque fait est `rapporte_par_williams`, locuteur `axion` : une dictée ne
 *     produit JAMAIS une citation du client (`verifier-faits.ts`) ;
 *   · le compte rendu porte `origine = dictee`, les faits `source = dictee` ;
 *   · elle ALIMENTE le suivi du rendez-vous (`RencontreSuivi`) : issue « a eu
 *     lieu », une suite et une date de relance PROPOSÉES (auteur nul), que
 *     Will valide dans « Après l'appel ».
 *
 * Éteinte tant que `DICTEE_ANNONCEE` (source unique `visio-annonce.ts`) vaut
 * faux : la route répond 503 `dictee_non_annoncee`, le bouton de l'extension
 * le dit.
 *
 * Module PUR.
 */

import type { FaitType, RendezVousSuite } from "../../../prisma/generated/client";
import { RELANCE_PAR_DEFAUT_JOURS_OUVRES } from "@/features/dossier-client/seuils";
import { jourOuvreApres } from "@/features/dossier-client/suite-proposee";

/** Durée d'une dictée annoncée à Will (l'extension coupe à la borne haute). */
export const DUREE_DICTEE_MIN_S = 120;
export const DUREE_DICTEE_MAX_S = 300;

export interface SuiteProposee {
  readonly issue: "eu_lieu";
  readonly suite: RendezVousSuite;
  readonly suiteLe: Date;
}

/**
 * La suite PROPOSÉE après une dictée : une relance, à la date de la prochaine
 * étape dictée si elle est datée et future, sinon à +5 jours ouvrés (B11,
 * comptés depuis le jour de PARIS, comme la suite par défaut d'« Après l'appel ») ;
 * « devis » si une offre a été envisagée et qu'aucune étape n'est datée.
 */
export function suiteProposeeApresDictee(a: {
  readonly faits: ReadonlyArray<{ readonly type: FaitType; readonly dateCible: Date | null }>;
  readonly dateRencontre: Date;
}): SuiteProposee {
  const datee = a.faits
    .filter((f) => f.type === "prochaine_etape" && f.dateCible !== null)
    .map((f) => f.dateCible as Date)
    .filter((d) => d.getTime() > a.dateRencontre.getTime())
    .sort((x, y) => x.getTime() - y.getTime())[0];
  if (datee !== undefined) return { issue: "eu_lieu", suite: "relance", suiteLe: datee };
  const offre = a.faits.some((f) => f.type === "offre_envisagee");
  return {
    issue: "eu_lieu",
    suite: offre ? "devis" : "relance",
    // La MÊME règle que « Après l'appel » (`jourOuvreApres`, jour de Paris) :
    // une seconde copie avait divergé (jour UTC, un jour ouvré d'écart après 22 h).
    suiteLe: new Date(
      `${jourOuvreApres(a.dateRencontre, RELANCE_PAR_DEFAUT_JOURS_OUVRES)}T00:00:00Z`,
    ),
  };
}

/** Le préambule ajouté à l'entrée de P1 pour une dictée (consigne commune inchangée). */
export const PREAMBULE_DICTEE =
  "<nature_de_l_echange>DICTÉE de Williams, seul, après un appel téléphonique avec le client. " +
  "Il n'y a pas de piste client : tout ce qui est dit est RAPPORTÉ par Williams. Chaque fait " +
  "s'appuie sur une phrase de Williams (locuteur AXION) ; n'invente aucune phrase du client." +
  "</nature_de_l_echange>";
