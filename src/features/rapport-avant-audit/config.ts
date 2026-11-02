/**
 * Interrupteur du rapport avant audit (2026-11-02) — modèle `crm-sync/config.ts`.
 *
 * ⚠️ ÉTEINT PAR DÉFAUT. Tant que `RAPPORT_AVANT_AUDIT_ENABLED` n'est pas exactement `"true"`, le
 * bouton de la console refuse de lancer un rapport, et le worker refuse de traiter un lancement
 * déjà posé (la ligne passe en `erreur`, rien n'est appelé). Il faut donc l'allumer sur les DEUX
 * conteneurs (app et worker) ; le rollback consiste à le remettre à `false`.
 *
 * Lu à CHAQUE appel (pas au chargement du module) : les tests changent d'avis entre deux cas.
 */
export function rapportAvantAuditActif(): boolean {
  return process.env.RAPPORT_AVANT_AUDIT_ENABLED === "true";
}

/** Le message montré à Will quand l'interrupteur est éteint. */
export const MESSAGE_INTERRUPTEUR_ETEINT =
  "Le rapport avant audit n'est pas encore activé (RAPPORT_AVANT_AUDIT_ENABLED).";
