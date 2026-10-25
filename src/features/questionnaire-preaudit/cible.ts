// Où vit un questionnaire de pré-audit : module PUR (aucun import), léger à charger.

/**
 * Où vit le questionnaire : sur un rendez-vous (cas historique) ou directement sur une fiche
 * client, SANS rendez-vous (`client_id`, décision de Will du 25/10/2026).
 */
export type CibleQuestionnaire = { readonly rencontreId: string } | { readonly clientId: string };

/**
 * Le questionnaire d'une fiche, hors rendez-vous. Suit une fusion de fiches vivante : celui d'une
 * fiche absorbée se lit sur la fiche qui l'a absorbée (rien n'est déplacé, donc « Défaire la
 * fusion » le rend sans rien savoir de lui).
 */
export function dunClient(clientId: string) {
  return {
    rencontreId: null,
    OR: [
      { clientId },
      { client: { fusionsAbsorbee: { some: { absorbantId: clientId, defaiteLe: null } } } },
    ],
  };
}
