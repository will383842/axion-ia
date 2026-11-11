/**
 * OPPOSITION RELUE JUSTE AVANT L'ENVOI (SITE-OUTBOX).
 *
 * Règle de Williams : un « stop » l'emporte TOUJOURS. Or un événement du guide
 * réseau est mis en file au clic, puis envoyé plus tard par le balayage : une
 * opposition reçue dans l'intervalle ne l'arrêtait pas. `emitOutboxRow` relit
 * donc l'opposition de l'adresse (par empreinte, `estOpposee`) au dernier
 * moment, pour ces événements seulement.
 *
 * Une ligne bloquée est SOLDÉE (`gave_up`, plus de prochaine tentative) avec ce
 * motif, sans appel réseau, sans tentative consommée. Rien n'est supprimé. Aucune
 * colonne nouvelle : le statut `gave_up` et `lastError` existent déjà.
 */

/** Motif posé sur une ligne bloquée. Jamais d'adresse dedans. */
export const BLOQUEE_PAR_OPPOSITION =
  "bloquée par opposition : un stop l'emporte, rien n'est envoyé";

const SOURCES_GUIDE_RESEAU = new Set(["guide-reseau", "guides-reseau"]);

/** Événements du guide : le clic (`lead_magnet_requested`) ou tout événement de source guide réseau. */
export function estEvenementGuideReseau(eventType: string, payload: unknown): boolean {
  if (eventType === "lead_magnet_requested") return true;
  if (typeof payload !== "object" || payload === null) return false;
  const source = (payload as Record<string, unknown>)["source_slug"];
  return typeof source === "string" && SOURCES_GUIDE_RESEAU.has(source);
}

/** Adresse portée par le corps de l'événement, ou null. Ne la journalise jamais. */
export function adresseDeLEvenement(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const person = (payload as Record<string, unknown>)["person"];
  if (typeof person !== "object" || person === null) return null;
  const email = (person as Record<string, unknown>)["email"];
  return typeof email === "string" && email.length > 0 ? email : null;
}
