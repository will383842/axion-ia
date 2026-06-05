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

// VIS-06 (audit visibilité 2026-06-05) — Les 5 intents « legacy » retournaient
// "" (aucune différenciation). Or l'intention commerciale/transactionnelle/locale
// est celle qui CONVERTIT. On ajoute un addendum structurel par intent. Doctrine
// respectée : 0 prix en dur (tokens {{price:...}}), FR, anti-doorway, 0 téléphone.

const INFORMATIONAL_ADDENDUM = `

## MODE INFORMATIONNEL — PÉDAGOGIE & PROFONDEUR
L'internaute cherche à COMPRENDRE (pas encore à acheter). Règles :
- Définition claire dès le 1er paragraphe, puis progression du simple au complexe
- Privilégier exemples concrets, schémas mentaux, analogies métier
- 0 argumentaire commercial agressif ; 1 seul CTA discret en fin (« Pour approfondir »)
- Liens internes vers ressources/guides plus profonds (maillage d'autorité)
- Chaque affirmation factuelle = source citable (INSEE, DARES, BPI, EU AI Act)`;

const COMMERCIAL_INVESTIGATION_ADDENDUM = `

## MODE INVESTIGATION COMMERCIALE — AIDE À LA DÉCISION
L'internaute COMPARE des solutions/prestataires avant de choisir. Règles :
- Exposer les CRITÈRES DE CHOIX objectifs (méthodologie, périmètre, livrables, délais)
- Tableau comparatif léger (3-5 lignes) si pertinent — facteurs de décision, pas de dénigrement concurrent
- Preuves : cas concrets, métriques de résultat, méthode Axion-IA
- CTA orienté évaluation (« Demander un audit », « Cadrer votre besoin »)
- AUCUN tarif chiffré dans le corps (0 prix en dur) ; renvoyer vers la page tarifs / un devis via le CTA
- Lever les objections (risque, réversibilité, montée en compétence interne)`;

const TRANSACTIONAL_ADDENDUM = `

## MODE TRANSACTIONNEL — PASSAGE À L'ACTION
L'internaute est PRÊT à engager. Règles :
- Bénéfices concrets et résultats attendus en tête (pas de théorie longue)
- CTA clair dès le 1er tiers ET en fin (« Demander un devis », « Réserver un cadrage »)
- Réassurance : déroulé de la prestation, livrables, étapes, garanties de méthode
- Section FAQ traitant les objections d'achat (périmètre, engagement, délais)
- AUCUN tarif chiffré dans le corps (0 prix en dur) ; orienter vers la page tarifs / un devis`;

const NAVIGATIONAL_ADDENDUM = `

## MODE NAVIGATIONNEL — ORIENTATION
L'internaute cherche une page/un service Axion-IA précis. Règles :
- Désambiguïser l'entité dès l'intro (qui est Axion-IA, quel service exact)
- Aller droit au but : liens internes directs vers la bonne page service/contact
- Contenu concis, pas de remplissage ; structure scannable (H2 = sections claires)
- Éviter la confusion avec d'autres entités au nom proche`;

const LOCAL_ADDENDUM = `

## MODE LOCAL — ANCRAGE GÉOGRAPHIQUE
L'internaute cherche une réponse ancrée sur SA ville/zone. Règles :
- Nommer la ville/zone dans le H1 et le 1er paragraphe (sans bourrage)
- Mentionner la couverture (intervention sur site + distanciel) — areaServed
- Exemples ou enjeux propres au tissu économique local quand pertinent
- Lien interne vers le hub ville correspondant
- NE PAS inventer d'adresse/horaires locaux (Axion-IA = service-area, pas vitrine physique)`;

/**
 * Retourne l'addendum à ajouter au SYSTEM_PROMPT selon l'intent.
 * VIS-06 : différenciation des 8 intents (3 AEO 2026 + 5 legacy). Seuls null /
 * undefined / intent inconnu retournent "".
 */
export function getIntentPromptAddendum(intent: string | null | undefined): string {
  switch (intent) {
    case "voice_search":
      return VOICE_SEARCH_ADDENDUM;
    case "ai_overview":
      return AI_OVERVIEW_ADDENDUM;
    case "featured_snippet":
      return FEATURED_SNIPPET_ADDENDUM;
    case "informational":
      return INFORMATIONAL_ADDENDUM;
    case "commercial_investigation":
      return COMMERCIAL_INVESTIGATION_ADDENDUM;
    case "transactional":
      return TRANSACTIONAL_ADDENDUM;
    case "navigational":
      return NAVIGATIONAL_ADDENDUM;
    case "local":
      return LOCAL_ADDENDUM;
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
