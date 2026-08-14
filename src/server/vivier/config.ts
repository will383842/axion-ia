/**
 * VIVIER CANDIDATS — drapeaux et règles de temps (lot L4, plan §2.3).
 *
 * ⚠️ INERTIE : tant que `VIVIER_STOCK_ENABLED` ne vaut pas exactement "true",
 * la campagne d'information au stock REFUSE de s'exécuter. Et tant que
 * `CRM_SYNC_CANDIDATES_ENABLED` est à OFF, l'intégration au vivier n'écrit
 * aucune ligne d'outbox. Deux verrous, deux étapes distinctes du séquencement.
 *
 * Comme pour la synchro, les drapeaux sont lus à CHAQUE appel (pas au
 * chargement du module) : les tests ont besoin de changer d'avis entre deux cas.
 */

/**
 * Autorise l'ENVOI de la campagne d'information au stock de candidatures.
 *
 * Séparé de `CRM_SYNC_CANDIDATES_ENABLED` à dessein : informer les candidats
 * doit pouvoir démarrer AVANT que le canal CRM ne s'ouvre — c'est même l'ordre
 * imposé, puisque la fenêtre d'opposition de 30 jours doit s'écouler d'abord.
 */
export function isVivierStockEnabled(): boolean {
  return process.env.VIVIER_STOCK_ENABLED === "true";
}

/**
 * FENÊTRE D'OPPOSITION — 30 jours pleins (décision actée, plan §2.3 option (b)).
 *
 * 🔴 CETTE VALEUR NE SE RACCOURCIT JAMAIS, ni « pour tester », ni « juste pour
 * cette fois ». Un candidat informé le jour J doit disposer de 30 jours francs
 * avant que sa candidature n'entre au vivier — c'est ce délai qui rend
 * l'information loyale, donc la conservation licite. Le raccourcir en dur
 * rendrait rétroactivement illicite toute intégration déjà faite.
 *
 * Les tests qui ont besoin d'une autre fenêtre passent un OVERRIDE EXPLICITE en
 * paramètre de fonction (`windowDays`) : la règle reste intacte, seul l'appel de
 * test s'en écarte, et cela se voit dans le test.
 */
export const VIVIER_OPPOSITION_WINDOW_DAYS = 30;

/**
 * Date limite avant laquelle une candidature informée ne peut PAS être intégrée.
 * Exposée séparément pour être testable sans horloge globale.
 */
export function vivierIntegrationCutoff(
  now: Date = new Date(),
  windowDays: number = VIVIER_OPPOSITION_WINDOW_DAYS,
): Date {
  return new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
}
