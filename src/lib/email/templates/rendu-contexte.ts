// Données PROPRES À UN RENDU d'e-mail (relecture sécurité, 2026-10-09).
//
// Le lien « Ne plus recevoir de sollicitations commerciales » porte l'ADRESSE du destinataire.
// Il vivait dans une variable de module posée par `renderEmailTemplate` avant plusieurs `await`
// (statistiques d'avis, rendu HTML, rendu texte) ; le worker rend deux e-mails à la fois
// (`concurrency: 2`) : l'e-mail de A pouvait partir avec le lien de B.
//
// Un contexte React n'est pas possible ici (`createContext` est interdit dans un module
// importé côté serveur : le build casse). D'où `AsyncLocalStorage` : chaque appel de
// `renderEmailTemplate` ouvre son propre stockage, qui suit ses `await` et ceux du rendu React,
// sans jamais être vu par un autre rendu. ⛔ Ne jamais remettre une donnée propre au
// destinataire dans une variable de module. Hors rendu (aperçus, tests d'un gabarit seul) :
// aucune donnée, donc aucun lien.

import { AsyncLocalStorage } from "node:async_hooks";

export interface DonneesRenduEmail {
  readonly oppositionHref: string | null;
}

const AUCUNE: DonneesRenduEmail = { oppositionHref: null };
const stockage = new AsyncLocalStorage<DonneesRenduEmail>();

/** Exécute un rendu avec SES données ; ni avant ni après, ni dans un autre rendu. */
export function avecDonneesRendu<T>(donnees: DonneesRenduEmail, rendu: () => Promise<T>): Promise<T> {
  return stockage.run(donnees, rendu);
}

/** Les données du rendu en cours (lues par le gabarit de base). */
export function donneesRendu(): DonneesRenduEmail {
  return stockage.getStore() ?? AUCUNE;
}
