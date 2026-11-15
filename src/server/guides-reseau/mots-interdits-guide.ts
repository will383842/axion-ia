/**
 * MOTS INTERDITS DANS LE TEXTE D'UN GUIDE FABRIQUÉ — 3e contrôle (après le prompt et le Studio).
 *
 * ⚠️ La liste doit rester IDENTIQUE à celle du Studio (fixture partagée
 * `__tests__/fixtures/mots-interdits-guide.json`). Normalisation : NFKD, sans accents, minuscules.
 * Le refus rend le NOM de la règle, jamais l'extrait du texte.
 */
export type RegleMotInterdit =
  "abonne" | "grenoble" | "garanti" | "certification" | "tutoiement" | "promesse_chiffree";

export const REGLES_MOTS_INTERDITS: ReadonlyArray<{ regle: RegleMotInterdit; motif: RegExp }> = [
  { regle: "abonne", motif: /\babonn/ },
  { regle: "grenoble", motif: /grenoble/ },
  { regle: "garanti", motif: /aucun gain garanti|\bgaranti/ },
  { regle: "certification", motif: /\bcertifi|qualiopi/ },
  { regle: "tutoiement", motif: /\b(tu|toi|ton|ta|tes|te|tien|tiens|tienne|tiennes)\b|\bt'/ },
  {
    regle: "promesse_chiffree",
    motif:
      /%|€|\beuros?\b|\b\d+\s*x\b|\bx\s*\d|\b(\d+|x|deux|trois|quatre|cinq|dix|cent)\s+fois\b|\bdoubl|\btripl/,
  },
];

export function normaliserPourRegles(texte: string): string {
  return texte.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[‘’ʼ]/g, "'").toLowerCase();
}

/** Première règle enfreinte, ou `null`. */
export function motInterditDans(texte: string): RegleMotInterdit | null {
  const n = normaliserPourRegles(texte);
  for (const { regle, motif } of REGLES_MOTS_INTERDITS) if (motif.test(n)) return regle;
  return null;
}
