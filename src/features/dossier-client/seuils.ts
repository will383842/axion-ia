/**
 * Seuils du dossier client — décision B11 de Will (prise sur recommandation,
 * `DECISIONS-POUR-WILL.md` §B11 : « deux réglages de confort »).
 *
 * Écrits UNE fois, ici. Changer un chiffre = une PR d'une ligne.
 */

/**
 * Un financement OPCO se monte en plusieurs semaines. Une échéance plus proche
 * que ce délai avec un financement OPCO annoncé est signalée dans « Préparer ».
 */
export const DELAI_OPCO_JOURS = 45;

/** Relance proposée quand rien n'est convenu à la fin d'un rendez-vous (jours ouvrés). */
export const RELANCE_PAR_DEFAUT_JOURS_OUVRES = 5;
