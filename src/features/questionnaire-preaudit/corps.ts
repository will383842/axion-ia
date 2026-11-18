/**
 * Lecture PLAFONNÉE d'un corps de requête (2026-10-24) : on s'arrête au plafond, on ne lit pas
 * tout puis on compte (un `Content-Length` absent ou menteur ne protège de rien).
 */

export async function lireCorpsPlafonne(req: Request, maxOctets: number): Promise<string | null> {
  const declare = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declare) && declare > maxOctets) return null;
  if (req.body === null) return "";
  const lecteur = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxOctets) {
      await lecteur.cancel();
      return null;
    }
    morceaux.push(value);
  }
  return Buffer.concat(morceaux).toString("utf8");
}

/** Pour la page : quoi faire quand le serveur refuse une réponse ou un brouillon trop gros. */
export const MESSAGE_TROP_GROS =
  "Vos réponses dépassent la taille acceptée. Gardez cette page ouverte : rien n'est perdu tant " +
  "qu'elle est ouverte. Téléchargez le PDF de vos réponses, raccourcissez les textes les plus " +
  "longs, puis réessayez.";

/** Le corps d'un refus 413 : motif lisible, taille déclarée (ou `null`) et plafond. */
export function refusTropGros(req: Request, plafond: number): Record<string, unknown> {
  const declare = Number(req.headers.get("content-length") ?? "");
  return {
    ok: false,
    motif: "charge_trop_grosse",
    taille: Number.isFinite(declare) && declare > 0 ? declare : null,
    plafond,
    message: MESSAGE_TROP_GROS,
  };
}
