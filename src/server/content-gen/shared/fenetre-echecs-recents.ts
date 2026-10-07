// Fenêtre du badge « jobs en échec » de la console (2026-10-07, demande de Will).
//
// Le badge ne compte que les échecs des FENETRE_ECHECS_RECENTS_JOURS derniers
// jours. Les échecs plus anciens restent en base et listés dans « Génération de
// contenu », sans alerte : rien n'est supprimé ni annulé (une annulation creuse
// un trou définitif dans le plan, cf. recovery/__tests__/plan-order.spec.ts).

export const FENETRE_ECHECS_RECENTS_JOURS = 30;

export function debutFenetreEchecsRecents(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() - FENETRE_ECHECS_RECENTS_JOURS * 24 * 60 * 60 * 1000);
}
