/**
 * Gardes de TEXTE des passes à la demande (questionnaire, e-mail de suivi) —
 * chantier visio, PR 7 ; `compte-rendu-et-extraction.md` §4.2 (G14, G15).
 *
 * Elles PROLONGENT les règles communes de `verification/regles.ts` (PR 6),
 * sans les recopier :
 *
 *   · G14 — `contientUnPrix` des règles communes (€, euros, TVA, HT, TTC,
 *     « prix … chiffre »), plus les mots qu'un texte LU PAR UN CLIENT ne doit
 *     pas porter non plus : tarif, remise, montant, coût, budget ;
 *   · G15 (adresses) — ni lien, ni adresse e-mail, ni téléphone : un texte
 *     produit par l'IA qui part chez un client ne l'envoie nulle part ;
 *   · G9 réduit — les nombres se lisent par `nombresDuTexte` (G4).
 *
 * Fonctions PURES. Elles jugent un texte ; elles ne le corrigent jamais (un
 * texte fautif est retiré, pas réécrit en silence).
 */

import { nombresDuTexte } from "../verification/g04-valeurs";
import { contientUnPrix as parleDArgent } from "../verification/regles";

const RE_URL = /(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:fr|com|net|org|io|eu|co|info|biz)\b/i;
const RE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const RE_TELEPHONE = /(?:\+33\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/;

/** G15 : lien, adresse e-mail ou téléphone. */
export function contientUneAdresse(texte: string): boolean {
  return RE_URL.test(texte) || RE_EMAIL.test(texte) || RE_TELEPHONE.test(texte);
}

const RE_MOTS_DE_PRIX = /\b(?:prix|tarifs?|tarification|remises?|montants?|co[uû]ts?|budgets?)\b/i;

/** G14 pour un texte lu par un client : les règles communes, plus les mots de prix. */
export function contientUnPrix(texte: string): boolean {
  return parleDArgent(texte) || RE_MOTS_DE_PRIX.test(texte);
}

/**
 * G9 réduit, pour l'e-mail de suivi : chaque nombre écrit dans le texte figure
 * dans l'une des sources (énoncés des faits). Rend les nombres absents.
 */
export function nombresAbsentsDesSources(texte: string, sources: ReadonlyArray<string>): number[] {
  const connus = new Set(sources.flatMap(nombresDuTexte));
  // « un », « une » se lisent 1 : on ne juge qu'à partir de 2 (même seuil que G15).
  return nombresDuTexte(texte).filter((n) => n >= 2 && !connus.has(n));
}
