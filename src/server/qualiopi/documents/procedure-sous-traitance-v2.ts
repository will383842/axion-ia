/**
 * Procédure de sous-traitance v2.0 — le MÉCANISME de remplacement (lot L14,
 * NC13 ind. 27), sans le texte.
 *
 * Ce que la console doit pouvoir faire : sortir une procédure v2.0, dire sur la
 * pièce qu'elle remplace (« la 044 ») que celle-ci ne fait plus foi — avec un lien
 * EXPLICITE vers la nouvelle (`rectifie` / `remplaceeParNumero`, le mécanisme
 * existant de `generateDocument`) — et annuler, motif à l'appui, l'ancienne pièce
 * restée en circulation (« la 029 »). Rien ne s'efface : on annule, on remplace.
 *
 * 🔴 LA GÉNÉRATION EST ÉTEINTE. Le texte de la v2.0 n'existe pas encore : le
 * gabarit ne porte que la v1.0. Produire un PDF « version 2.0 » avec les articles
 * de la v1.0 serait une pièce qui ment sur son contenu — exactement ce que le
 * commentaire de `PROCEDURE_SOUS_TRAITANCE_VERSION` interdit. L'interrupteur
 * ci-dessous se rallume dans la PR qui apporte le texte, jamais avant.
 *
 * Module PUR (pas de base, pas de session) : les règles de choix des pièces.
 */

export const PROCEDURE_SOUS_TRAITANCE_V2_VERSION = "2.0";

/**
 * Le texte de la v2.0 est-il rédigé dans le gabarit ?
 * `false` tant que `templates/procedure-sous-traitance.tsx` ne porte que la v1.0.
 */
export function texteProcedureV2Redige(): boolean {
  return false;
}

export const MESSAGE_V2_ETEINTE =
  "La procédure de sous-traitance v2.0 n'est pas encore rédigée : la génération reste éteinte. Aucune pièce n'a été créée, remplacée ni annulée.";

export interface PieceProcedure {
  readonly id: string;
  readonly numero: string;
  readonly type: string;
  readonly annuleeAt: Date | null;
}

export type PlanRemplacement =
  | {
      readonly ok: true;
      readonly remplacee: PieceProcedure;
      readonly aAnnuler: PieceProcedure | null;
    }
  | { readonly ok: false; readonly error: string };

const TYPE_PROCEDURE = "procedure_sous_traitance";

/**
 * Décide, AVANT toute écriture, si le remplacement est possible : les deux
 * pièces existent, ce sont bien des procédures de sous-traitance (on ne remplace
 * ni n'annule une convention par erreur de frappe), la pièce remplacée est encore
 * valable, et ce ne sont pas la même pièce.
 */
export function planifierRemplacementProcedure(e: {
  readonly numeroRemplacee: string;
  readonly remplacee: PieceProcedure | null;
  readonly numeroAAnnuler: string | undefined;
  readonly aAnnuler: PieceProcedure | null;
}): PlanRemplacement {
  if (e.remplacee === null) return { ok: false, error: `Pièce ${e.numeroRemplacee} introuvable.` };
  if (e.remplacee.type !== TYPE_PROCEDURE) {
    return {
      ok: false,
      error: `La pièce ${e.remplacee.numero} n'est pas une procédure de sous-traitance.`,
    };
  }
  if (e.remplacee.annuleeAt !== null) {
    return {
      ok: false,
      error: `La pièce ${e.remplacee.numero} est déjà annulée : elle ne peut pas être « remplacée ».`,
    };
  }

  if (e.numeroAAnnuler === undefined) return { ok: true, remplacee: e.remplacee, aAnnuler: null };

  if (e.aAnnuler === null) return { ok: false, error: `Pièce ${e.numeroAAnnuler} introuvable.` };
  if (e.aAnnuler.id === e.remplacee.id) {
    return {
      ok: false,
      error: "La pièce à annuler doit être différente de la pièce remplacée.",
    };
  }
  if (e.aAnnuler.type !== TYPE_PROCEDURE) {
    return {
      ok: false,
      error: `La pièce ${e.aAnnuler.numero} n'est pas une procédure de sous-traitance.`,
    };
  }
  if (e.aAnnuler.annuleeAt !== null) {
    return { ok: false, error: `La pièce ${e.aAnnuler.numero} est déjà annulée.` };
  }
  return { ok: true, remplacee: e.remplacee, aAnnuler: e.aAnnuler };
}
