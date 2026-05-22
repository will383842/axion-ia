/**
 * Phase D Sprint Perfection 2026-05-22 — Intent Prompt Adapter.
 *
 * Injecte un addendum SYSTEM_PROMPT selon `targetSearchIntent` 2026 :
 *   - voice_search : contenu lu à voix haute (phrases courtes, conversationnel)
 *   - ai_overview  : optimisé Google AI Overview / SGE (factuel, sourcé)
 *   - featured_snippet : position 0 Google (40-60 mots, data-aeo="tldr")
 *
 * Pour les 5 intents legacy (informational, transactional, etc.) :
 * retourne "" (pas d'addendum — comportement inchangé).
 *
 * Usage : append au SYSTEM_PROMPT dans chaque generator
 *   const prompt = SYSTEM_PROMPT + getIntentPromptAddendum(input.targetSearchIntent);
 */

export type SearchIntentAll =
  | "informational"
  | "commercial_investigation"
  | "transactional"
  | "navigational"
  | "local"
  | "voice_search"
  | "ai_overview"
  | "featured_snippet";

const VOICE_SEARCH_ADDENDUM = `

## MODE VOICE SEARCH — OPTIMISATION ASSISTANT VOCAL
Ce contenu sera potentiellement lu à voix haute par un assistant vocal (Alexa, Siri, Google Assistant).
Règles supplémentaires obligatoires :
- Phrases courtes (max 15 mots par phrase — compter rigoureusement)
- Réponse directe IMPÉRATIVE dans le 1er paragraphe (style Q&R conversationnel)
- Pas de listes à puces dans les 200 premiers mots (incompatible TTS)
- H1 formulé comme une question complète (ex : "Comment auditer une IA d'entreprise à Paris ?" — jamais "audit IA Paris")
- Transitions naturelles à l'oral ("D'abord,", "Ensuite,", "Finalement,")
- Éviter les tableaux, acronymes non déployés, abréviations sans explication`;

const AI_OVERVIEW_ADDENDUM = `

## MODE AI OVERVIEW — OPTIMISATION GOOGLE SGE / AI OVERVIEW
Ce contenu vise à être résumé par Google AI Overview ou Perplexity.
Règles supplémentaires obligatoires :
- Définition précise + sourcée OBLIGATOIRE dans le 1er paragraphe (40-50 mots max)
- Structure factuelle canonique : qu'est-ce que / pourquoi / comment / quand
- Citations sources autorité (INSEE, Stanford AI Index, McKinsey, BPI France, EU AI Act) avec liens <a>
- Minimum 2 sources externes d'autorité mentionnées avec URL rel="noopener noreferrer"
- Ajouter schema JSON-LD ItemList pour les étapes numérotées
- Pas d'opinion non sourcée — chaque affirmation = source citable
- Le champ directAnswer DOIT répondre en 2 phrases max à la question principale`;

const FEATURED_SNIPPET_ADDENDUM = `

## MODE FEATURED SNIPPET — OPTIMISATION POSITION 0 GOOGLE
Ce contenu vise la position 0 (featured snippet) dans les SERPs Google.
Règles supplémentaires obligatoires :
- Paragraphe de réponse 40-60 MOTS EXACTEMENT avec attribut data-aeo="tldr" sur la balise <p>
  Format : "Un [sujet] est [définition courte]. Il permet de [bénéfice clé] en [contexte]. [Source ou autorité]."
- Pour les questions "comment" / "étapes" : liste <ul> ou <ol> de 5-8 points concis (max 15 mots/item)
- Pour "comparer" / "différence entre" : tableau <table> 3-5 lignes (EXCEPTION à la règle no-table comparative)
- Premier H2 = la question exacte reformulée (pas de paraphrase)
- Pas d'introduction promotionnelle avant le snippet (Google l'ignore)`;

/**
 * Retourne l'addendum à ajouter au SYSTEM_PROMPT selon l'intent.
 * Retourne "" pour les intents legacy (comportement inchangé).
 */
export function getIntentPromptAddendum(intent: string | null | undefined): string {
  switch (intent) {
    case "voice_search":
      return VOICE_SEARCH_ADDENDUM;
    case "ai_overview":
      return AI_OVERVIEW_ADDENDUM;
    case "featured_snippet":
      return FEATURED_SNIPPET_ADDENDUM;
    default:
      return "";
  }
}

/**
 * Heuristique de classification intent 2026.
 * Retourne le SearchIntent probable pour un keyword donné.
 * Utilisé par le script de mapping initial.
 */
export function classifyKeywordIntent(keyword: string): SearchIntentAll | null {
  const kw = keyword.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // voice_search : question longue (≥ 4 mots) commençant par mot interrogatif
  const VOICE_TRIGGERS =
    /^(comment|qu['\s]est[\s-]ce que|pourquoi|ou|quand|est[\s-]ce que|quelle?s?|comment faire|comment utiliser)/;
  if (VOICE_TRIGGERS.test(kw) && kw.split(/\s+/).length >= 4) return "voice_search";

  // ai_overview : intent factuel direct (définition, explication)
  const AIO_TRIGGERS =
    /\b(qu['\s]est[\s-]ce qu|definition|definir|signification|expliqu|c['\s]est quoi|introduction a)\b/;
  if (AIO_TRIGGERS.test(kw)) return "ai_overview";

  // featured_snippet : court (2-4 mots) + intent informatif direct sans géo
  const FS_NOT_LOCAL =
    !/\b(paris|lyon|marseille|france|region|departement|ville|proche|a proximite)\b/.test(kw);
  const isShort = kw.split(/\s+/).length <= 4;
  if (
    isShort &&
    FS_NOT_LOCAL &&
    /\b(audit|formation|coaching|implentation|ia|intelligence artificielle)\b/.test(kw)
  ) {
    return "featured_snippet";
  }

  return null; // intent non déterminable heuristiquement
}
