/**
 * COUPURE DU RECRUTEMENT vers le CRM (ADR 0047, révision § 4 ter).
 *
 * Décision de Will : aucune candidature ne franchit la frontière vers le CRM,
 * le vivier est tenu par la console du site. La règle vit ICI, une fois, et
 * elle est appliquée aux deux seuls passages obligés de la synchro :
 *   · `enqueueCrmSyncEvent` : aucune ligne n'est plus CRÉÉE ;
 *   · `emitOutboxRow` : une ligne d'AVANT la coupure, encore `pending` ou
 *     `failed`, est soldée sans appel réseau au lieu d'être rejouée.
 *
 * Ce qui reste permis : l'`opt_out` de l'univers vivier (l'opposition d'une
 * personne dont la fiche est DÉJÀ au CRM), qui n'est pas une candidature.
 */

/** Motif posé sur une ligne soldée par la coupure. */
export const ENVOI_COUPE = "ADR 0047 révision : envoi coupé, rien du recrutement ne part au CRM";

/**
 * Vrai pour une candidature (`application_submitted`) ou un `/contact` de type
 * « recrutement » (`form_submission` dont `form_type` vaut `recrutement`).
 * `payload` est le corps de l'événement tel que posé dans l'outbox.
 */
export function estEnvoiCoupe(eventType: string | null | undefined, payload: unknown): boolean {
  if (eventType === "application_submitted") return true;
  if (eventType !== "form_submission") return false;
  if (typeof payload !== "object" || payload === null) return false;
  return (payload as Record<string, unknown>)["form_type"] === "recrutement";
}
