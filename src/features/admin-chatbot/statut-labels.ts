/**
 * Libellés français des statuts du chatbot.
 *
 * 🔴 Le statut d'une conversation s'affichait en valeur brute — « active » —
 * à deux endroits : la colonne « Statut » de la liste et la ligne de contexte
 * du détail. Vérifié en base de production le 2026-08-03 : c'est bien la seule
 * valeur en usage pour les conversations, et « ouverte » / « resolue » pour
 * les escalades.
 *
 * Ces deux statuts ne sont PAS un enum Prisma (colonnes `VarChar(20)` avec
 * valeur par défaut) : rien à la compilation ne signalerait une valeur neuve.
 * D'où le repli qui CITE la valeur inconnue plutôt que de l'habiller — une
 * valeur citée se remarque, une valeur maquillée passe.
 */

export const LIBELLE_STATUT_CONVERSATION: Record<string, string> = {
  active: "En cours",
  close: "Terminée",
  cloturee: "Clôturée",
};

export const LIBELLE_STATUT_ESCALADE: Record<string, string> = {
  ouverte: "Ouverte",
  resolue: "Résolue",
};

export function libelleStatutConversation(statut: string): string {
  return LIBELLE_STATUT_CONVERSATION[statut] ?? `« ${statut} »`;
}

export function libelleStatutEscalade(statut: string): string {
  return LIBELLE_STATUT_ESCALADE[statut] ?? `« ${statut} »`;
}
