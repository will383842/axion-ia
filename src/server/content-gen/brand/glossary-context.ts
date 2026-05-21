/**
 * Glossaire IA contexte pour générateurs de contenu (P4 Sprint P1-7).
 *
 * Injecte les définitions des termes glossaire matchant les keywords de
 * l'article dans le system prompt. Permet l'expansion correcte des acronymes
 * LLM/RAG/NLP dans le contenu généré et la cohérence terminologique.
 *
 * Source : src/content/glossary-extension.ts (60 termes IA, Sprint S+4-A).
 *
 * Usage : `getGlossaryContext(["RAG", "LLM", "fine-tuning"])` retourne
 * un bloc texte "Vocabulaire de référence : ..." à injecter dans le prompt.
 */

import { ALL_GLOSSARY_TERMS_EXTENDED } from "@/content/glossary-extension";

/** Normalise un terme pour comparaison case-insensitive + sans tirets. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_\s]+/g, "");
}

/**
 * Retourne les définitions des termes glossaire pertinents pour les keywords
 * de l'article. Limite à 6 termes pour éviter de surcharger le context window.
 */
export function getGlossaryContext(keywords: string[]): string {
  if (!keywords || keywords.length === 0) return "";

  const normalizedKws = keywords.map(normalize);

  const matched = ALL_GLOSSARY_TERMS_EXTENDED.filter((term) => {
    const termNorm = normalize(term.term);
    const slugNorm = normalize(term.slug);
    const aliasNorms = (term.aliases ?? []).map(normalize);
    return normalizedKws.some(
      (kw) =>
        termNorm.includes(kw) ||
        kw.includes(termNorm) ||
        slugNorm.includes(kw) ||
        aliasNorms.some((a) => a.includes(kw) || kw.includes(a)),
    );
  }).slice(0, 6);

  if (matched.length === 0) return "";

  const lines = matched.map((t) => `- ${t.term} : ${t.fr}`);
  return `\n\n## Vocabulaire de référence (termes IA à utiliser tels quels)\n${lines.join("\n")}`;
}
