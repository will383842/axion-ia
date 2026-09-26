/**
 * Noms des traces `activity_logs` de la lettre que la liste de suppression
 * relit (`exports.ts`). Module sans dépendance : l'export ne tire pas la
 * chaîne d'effacement (`effacer.ts` → `rgpd-erase`, CRM) pour trois chaînes.
 *
 * 🔴 Le préfixe `gdpr.` n'est pas cosmétique : la purge des journaux
 * (`retention-purge-worker.ts`) n'épargne à 12 mois QUE les actions `gdpr.*`
 * (conservées 5 ans, l'échéance des pièces). Voir `effacer.ts`.
 */

/** Effacement d'un abonné depuis la console (depuis le 2026-09-26). */
export const ACTION_EFFACEMENT_CONSOLE = "gdpr.newsletter.erased";
/** Ancien nom de la même trace (avant le 2026-09-26), encore relu par l'export. */
export const ACTION_EFFACEMENT_CONSOLE_HISTORIQUE = "newsletter.erased";
/**
 * Désinscrit purgé à 3 ans (`retention.ts`, `purgerDesinscrits`) : SHA-256 dans
 * `emailHash`. `retention.ts` l'écrit en LITTÉRAL (son verrou lit la source) ;
 * `exports.spec.ts` vérifie que les deux chaînes restent égales.
 */
export const ACTION_DESINSCRIT_PURGE = "newsletter.purged";
