/**
 * Réseau d'apporteurs — l'interrupteur de la page « Mes commissions » de l'espace apporteur
 * (lecture seule) et de sa route de téléchargement des factures.
 *
 * ABSENT = ÉTEINT : allumé SEULEMENT si `APPORTEUR_MES_COMMISSIONS_ENABLED` vaut exactement
 * "true". Lu à CHAQUE appel, jamais figé à l'import. Cible : le SITE.
 *
 * ⚠️ Côté SERVEUR seulement : importé par un composant client, il rendrait toujours `false`
 * (la variable n'est pas `NEXT_PUBLIC_`).
 */
export function mesCommissionsActive(): boolean {
  return process.env.APPORTEUR_MES_COMMISSIONS_ENABLED === "true";
}
