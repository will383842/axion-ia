/**
 * Formateurs indépendants — LA règle du blocage par désaccord (lot D2, M10).
 *
 * Pur : aucun import. Lue par la transition du « payé »
 * (`transitionStatementAction`) et par la vue des virements : une seule source.
 *
 * Une facture contestée ne se paie pas, SAUF si le désaccord a été clos
 * « non retenu » par un administrateur (motif écrit, F59, tracé sur le relevé).
 * Clos « accepté », la pièce est annulée par avoir : elle ne se paie plus du tout.
 * `contesteeAt` n'est jamais effacé ; seule la clôture lève le blocage.
 */

export const ISSUE_DESACCORD_NON_RETENU = "non_retenue";
export const ISSUE_DESACCORD_ACCEPTE = "acceptee";

export function desaccordBloquant(r: {
  readonly contesteeAt: Date | null | undefined;
  readonly contestationCloseIssue?: string | null;
}): boolean {
  return r.contesteeAt != null && r.contestationCloseIssue !== ISSUE_DESACCORD_NON_RETENU;
}
