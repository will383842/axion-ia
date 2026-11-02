/**
 * Mots et tournures INTERDITS dans tout texte destiné au client (PDF) — ordres permanents de Will :
 *   · jamais « certifié » ni « Qualiopi » à propos d'Axion IA ;
 *   · jamais « Grenoble » (« partout en France ») ;
 *   · jamais « gain garanti » / « Aucun gain garanti » (aucune promesse chiffrée).
 *
 * Comparaison insensible à la casse et aux accents. PUR.
 */

const INTERDITS: ReadonlyArray<{ readonly motif: RegExp; readonly nom: string }> = [
  { motif: /\bcertifi/, nom: "« certifié »" },
  { motif: /\bqualiopi\b/, nom: "« Qualiopi »" },
  { motif: /\bgrenoble\b/, nom: "« Grenoble »" },
  { motif: /\bgains?\s+garanti/, nom: "« gain garanti »" },
];

function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Les interdits trouvés dans le texte (liste vide : rien à signaler). */
export function motsInterditsDans(texte: string): string[] {
  const t = normaliser(texte);
  return INTERDITS.filter((i) => i.motif.test(t)).map((i) => i.nom);
}
