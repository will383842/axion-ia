/**
 * L'issue de l'échange avec un CANDIDAT APPORTEUR — la famille `apporteur` du module commun
 * `issue-echange.ts` (FAC-7). Même noms, mêmes signatures qu'avant l'extraction.
 *
 * ⚠️ Aucun import ici hors du module commun (lui-même `zod` seulement) : le module est lu
 * par un composant client (les libellés) et doit le rester.
 */

import {
  GABARITS_ISSUE_PAR_FAMILLE,
  gabaritDeLIssue as gabaritDeLIssueEchange,
  type IssueEchange,
} from "./issue-echange";

export {
  ISSUES_ECHANGE as ISSUES_APPORTEUR,
  DECISIONS_ECHANGE as DECISIONS_APPORTEUR,
  LIBELLE_ISSUE_ECHANGE as LIBELLE_ISSUE_APPORTEUR,
  versSuivi,
  issueDepuisSuivi,
  classeSansSuite,
  echangeTenu,
  MOT_PERSONNEL_MAX,
  issueEchangeSchema as issueApporteurSchema,
  lireFormulaireIssueEchange as lireFormulaireIssueApporteur,
  normaliserIssueEchange as normaliserIssueApporteur,
  jourMoisParis,
  libellePointEchange as libellePointApporteur,
  decisionAffichee,
} from "./issue-echange";
export type {
  IssueEchange as IssueApporteur,
  DecisionEchange as DecisionApporteur,
  IssueEchangeSaisie as IssueApporteurSaisie,
  PointEchange as PointApporteur,
  EchangeAvecPoint,
  DecisionAffichee,
} from "./issue-echange";

/**
 * Noms des gabarits — aussi la clé d'idempotence lue dans le journal des envois
 * (`EmailLog.template`). Ils doivent rester égaux aux entrées de
 * `lib/email/templates/index.tsx` (vérifié par le test des gabarits).
 */
export const GABARIT_ISSUE_ABSENT = GABARITS_ISSUE_PAR_FAMILLE.apporteur.absent;
export const GABARIT_ISSUE_RETENU = GABARITS_ISSUE_PAR_FAMILLE.apporteur.retenu;
export const GABARIT_ISSUE_NON_RETENU = GABARITS_ISSUE_PAR_FAMILLE.apporteur.non_retenu;

export type GabaritIssueApporteur =
  typeof GABARIT_ISSUE_ABSENT | typeof GABARIT_ISSUE_RETENU | typeof GABARIT_ISSUE_NON_RETENU;

export const GABARITS_ISSUE_APPORTEUR: readonly GabaritIssueApporteur[] = [
  GABARIT_ISSUE_ABSENT,
  GABARIT_ISSUE_RETENU,
  GABARIT_ISSUE_NON_RETENU,
];

/**
 * L'e-mail que cette issue fait partir, ou `null`.
 *
 * `absencesAnterieures` : les AUTRES échanges de la même personne déjà notés
 * « Absent ». Dès la deuxième absence, on ne propose plus de nouveau créneau.
 */
export function gabaritDeLIssue(
  issue: IssueEchange,
  absencesAnterieures: number,
): GabaritIssueApporteur | null {
  return gabaritDeLIssueEchange<GabaritIssueApporteur>(
    GABARITS_ISSUE_PAR_FAMILLE.apporteur,
    issue,
    absencesAnterieures,
  );
}
