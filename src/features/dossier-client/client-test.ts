/**
 * Le CLIENT FICTIF du pilote (chantier visio, PR 4 ; plan §3.16, V-05b).
 *
 * Le pilote (jalon O-1) se joue sur une fiche fictive, « Atelier Test
 * Fictif », inscrite dans `clients_test_interne` par `scripts/visio/pilote.ts`
 * — jamais sur une vraie fiche. Une rencontre de test (`estTestInterne`) ne
 * se crée QUE :
 *   · en mode pilote disponible — `modePiloteDisponible()` : vrai seulement
 *     si une fiche fictive existe. La PR 5 remplace cette constante lue en base
 *     par le drapeau `ferme | pilote | ouvert` ;
 *   · ET sur la fiche du client fictif.
 * La case « test interne » n'est même pas RENDUE ailleurs. Garde :
 * `la-case-test-interne-n-existe-qu-en-pilote-et-sur-le-client-fictif.spec.ts`.
 *
 * Une rencontre de test n'apparaît dans AUCUNE synthèse d'un autre client ni
 * dans aucun compteur : `HORS_RENCONTRES_DE_TEST` est le filtre à poser, par
 * étalement (`where: { ...HORS_RENCONTRES_DE_TEST, … }`) — jamais le littéral
 * retapé (garde `une-rencontre-de-test-n-apparait-dans-aucune-synthese.spec.ts`).
 *
 * Module neutre.
 */

import type { Tx } from "./base";

type TxTest = Pick<Tx, "clientTestInterne">;

/** Cette fiche est-elle le client fictif du pilote ? */
export async function estClientTestInterne(tx: TxTest, clientId: string): Promise<boolean> {
  const l = await tx.clientTestInterne.findUnique({
    where: { clientId },
    select: { clientId: true },
  });
  return l !== null;
}

/** Le mode pilote est-il disponible (une fiche fictive existe) ? */
export async function modePiloteDisponible(tx: TxTest): Promise<boolean> {
  return (await tx.clientTestInterne.count()) > 0;
}

/** La case « test interne » se montre-t-elle ? PURE. */
export function caseTestInterneVisible(e: {
  readonly modePilote: boolean;
  readonly surLeClientFictif: boolean;
}): boolean {
  return e.modePilote && e.surLeClientFictif;
}

/** Le filtre Prisma qui écarte les rencontres de test d'une lecture. */
export const HORS_RENCONTRES_DE_TEST = { estTestInterne: false } as const;
