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
