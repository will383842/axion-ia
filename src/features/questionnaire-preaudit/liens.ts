/**
 * Les liens du questionnaire avant audit (2026-10-26) — module LÉGER (jetons et `SITE_URL`, ni
 * Prisma ni authentification) : le suivi du worker les fabrique sans tirer la console.
 * `serveur.ts` les ré-exporte pour ses appelants historiques.
 */

import { SITE_URL } from "@/lib/site-url";
import {
  codeDirigeantPreaudit,
  jetonArretRelancesPreaudit,
  jetonPreaudit,
} from "@/server/visio/questionnaire-en-ligne/jeton";

/** Le chemin public d'un questionnaire (page à jeton), ou `null` sans secret de production. */
export function cheminPreaudit(id: string): string | null {
  const jeton = jetonPreaudit(id);
  return jeton === null ? null : `/questionnaire/preaudit/${id.toLowerCase()}/${jeton}`;
}

/**
 * Le lien ENVOYÉ AU DIRIGEANT : le chemin public + son code personnel `m` (brouillon, voir
 * `brouillon.ts`). Les liens des salariés sont fabriqués par la page, sans ce code.
 */
export function urlPreaudit(id: string): string | null {
  const chemin = cheminPreaudit(id);
  const code = codeDirigeantPreaudit(id);
  return chemin === null || code === null ? null : `${SITE_URL}${chemin}?m=${code}`;
}

/**
 * La page « Ne plus recevoir de rappel » d'un questionnaire (2026-10-26) : jeton d'ARRÊT, distinct
 * du jeton du questionnaire. `null` sans secret (aucune relance ne part alors sans ce lien).
 */
export function urlArretRelances(id: string): string | null {
  const jeton = jetonArretRelancesPreaudit(id);
  return jeton === null ? null : `${SITE_URL}/questionnaire/rappels/${id.toLowerCase()}/${jeton}`;
}

/**
 * Le lien « Essayer » de la console : celui du dirigeant (son code `m`) en mode essai — Will
 * teste le parcours du dirigeant, brouillon compris, sans rien écrire.
 */
export function cheminEssaiPreaudit(id: string): string | null {
  const chemin = cheminPreaudit(id);
  const code = codeDirigeantPreaudit(id);
  return chemin === null || code === null ? null : `${chemin}?m=${code}&essai=1`;
}

/**
 * Où Will retrouve le questionnaire : son rendez-vous, sinon la page « Questionnaire » de la
 * fiche (envoi sans rendez-vous), sinon la liste des questionnaires sans rencontre.
 */
export const cheminConsole = (rencontreId: string | null, clientId: string | null = null) =>
  rencontreId !== null
    ? `rendez-vous/rencontres/${rencontreId}#questionnaire-avant-audit`
    : clientId !== null
      ? `qualiopi/clients/${clientId}/questionnaire#questionnaire-avant-audit`
      : "rendez-vous?vue=questionnaires";
