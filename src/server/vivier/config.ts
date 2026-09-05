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
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🛑 ORDRE PERMANENT DE WILL (2026-09-04) — CE DRAPEAU RESTE FERMÉ.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * **Rien ne part au CRM sans validation explicite de Will.** `VIVIER_STOCK_ENABLED`
 * n'est posée nulle part en production, et elle ne doit pas l'être — ni « pour
 * tester », ni parce qu'une recette a besoin de voir passer un e-mail.
 *
 * ⚠️ NE PAS SE RASSURER EN LISANT `CRM_SYNC_CANDIDATES_ENABLED=true`. Les deux
 * drapeaux `CRM_SYNC_*` SONT ouverts en production (vérifié le 2026-09-05, sur
 * les deux conteneurs). Ils sont inoffensifs **tant que celui-ci est fermé** :
 * c'est lui, et lui seul, qui déclenche la campagne d'information au stock. Un
 * lecteur qui voit deux drapeaux ouverts et en conclut que le canal est ouvert
 * se trompe de verrou ; un lecteur qui pose celui-ci « puisque les autres sont
 * déjà ouverts » ouvre le canal pour de bon.
 *
 * 🔑 ET L'OUVERTURE N'EST PAS RÉVERSIBLE COMME ELLE S'OUVRE. Refermer le
 * drapeau arrête les envois SUIVANTS ; il ne rappelle pas les e-mails partis, et
 * il ne remet pas à zéro les `vivierInfoSentAt` déjà horodatés — donc il ne
 * rejoue pas la fenêtre d'opposition de 30 jours qui vient de commencer pour
 * ces candidats. « On rouvrira si ça ne va pas » n'est pas une sortie.
 *
 * Décision et frontière : `docs/adr/0047-frontiere-console-recrutement-et-vivier-crm.md`.
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

/**
 * Version de consentement DÉDIÉE à l'intégration du STOCK (option (b) du plan
 * §2.3, décision actée) : l'acte juridique n'est pas une case cochée mais
 * l'email d'information `vivier-information` + 30 jours sans opposition.
 * Valeur FERME, énumérée côté CRM (`Taxonomy::CANDIDATE_CONSENT_VERSIONS_V2`) :
 * les deux listes bougent ENSEMBLE, sinon 422 en masse au J+30.
 */
export const VIVIER_STOCK_CONSENT_VERSION = "vivier-stock-2026-08-14";
