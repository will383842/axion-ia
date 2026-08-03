/**
 * Masque les valeurs sensibles d'un objet de réglages avant affichage.
 *
 * 🔴 POURQUOI (revue visuelle 2026-08-03). La page `/settings` rendait la clé
 * `legal_overrides` telle quelle, IBAN et BIC compris, en clair dans une liste
 * de six lignes. Une coordonnée bancaire n'a pas à s'afficher d'elle-même :
 * elle s'affiche quand on la demande.
 *
 * ⚠️ CE N'EST PAS UNE FRONTIÈRE DE SÉCURITÉ. La valeur complète reste envoyée
 * au navigateur pour le bouton « Afficher » — l'administrateur y a droit, il
 * peut de toute façon l'éditer. Ce que ce masquage empêche, c'est l'exposition
 * PASSIVE : une capture d'écran, un partage d'écran, quelqu'un derrière vous.
 * Pour retirer réellement la valeur du transport, il faudrait une route
 * dédiée — à faire le jour où la console aura d'autres lecteurs que Will.
 */

/** Clés dont la valeur ne s'affiche jamais spontanément. */
const CLES_SENSIBLES = /iban|bic|secret|token|password|passwd|api[_-]?key|private[_-]?key/i;

/**
 * Garde les 4 premiers et les 4 derniers caractères, remplace le reste.
 * Une chaîne trop courte pour ça est masquée entièrement — mieux vaut ne rien
 * montrer qu'un indice suffisant à la reconstituer.
 */
export function masquerValeur(valeur: string): string {
  const net = valeur.replace(/\s+/g, "");
  if (net.length <= 8) return "•".repeat(Math.max(net.length, 4));
  return `${net.slice(0, 4)} ${"•".repeat(4)} ${"•".repeat(4)} ${net.slice(-4)}`;
}

/**
 * Parcourt récursivement une valeur JSON et masque les chaînes portées par une
 * clé sensible. Les autres valeurs sont rendues intactes.
 */
export function masquerSecrets(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map((v) => masquerSecrets(v));
  if (valeur !== null && typeof valeur === "object") {
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      sortie[cle] =
        CLES_SENSIBLES.test(cle) && typeof v === "string" ? masquerValeur(v) : masquerSecrets(v);
    }
    return sortie;
  }
  return valeur;
}

/** Vrai si la valeur contient au moins une clé sensible — pilote le bouton. */
export function contientUnSecret(valeur: unknown): boolean {
  if (Array.isArray(valeur)) return valeur.some((v) => contientUnSecret(v));
  if (valeur !== null && typeof valeur === "object") {
    return Object.entries(valeur as Record<string, unknown>).some(
      ([cle, v]) => (CLES_SENSIBLES.test(cle) && typeof v === "string") || contientUnSecret(v),
    );
  }
  return false;
}
