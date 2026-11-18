// I2-3 — ce que l'approbation d'un e-mail de la file « à valider » envoie au worker.
//
// Deux fonctions PURES, appelées à l'identique par `approuverEmailAction` (l'envoi) et par
// `apercuOutboxAction` (l'aperçu) : une seule définition de la charge et de l'objet, donc un
// aperçu exact par construction.

/**
 * La charge mise en file : celle de la ligne, plus le message personnalisé saisi.
 * C'est le gabarit qui décide où l'insérer (et s'il le lit).
 */
export function chargeApprouvee(
  payload: unknown,
  message: string | undefined,
): Record<string, unknown> {
  const base =
    payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  return { ...base, ...(message ? { messagePersonnalise: message } : {}) };
}

/**
 * L'objet à FORCER au départ (`sujetForce`), ou `undefined` si le gabarit décide.
 * On ne force que s'il a CHANGÉ : un objet inchangé (ou le nom technique d'un vieux garage)
 * laisse le gabarit décider, comme avant.
 */
export function objetApprouve(
  saisi: string | undefined,
  objetDeLaFile: string,
): string | undefined {
  return saisi !== undefined && saisi !== objetDeLaFile ? saisi : undefined;
}
