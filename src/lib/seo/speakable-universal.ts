/**
 * AEO 2026 — Speakable universel (Sprint v7 Phase 11).
 *
 * SpeakableSpecification est un schema.org property qui marque les sections
 * d'une page comme "lisibles à voix haute" par les assistants vocaux + IA
 * conversationnelles (Google Assistant, Alexa, Siri, ChatGPT voice mode,
 * Claude voice mode).
 *
 * Pattern existant projet : `buildFaqSpeakableJsonLd` (src/lib/seo.ts ligne 708)
 * émet un FAQPage avec Speakable. Mais Speakable doit aussi pouvoir être
 * injecté dans WebPage, Article, Service, etc. (pas que FAQPage).
 *
 * Ce module expose des helpers réutilisables pour ajouter Speakable à tout
 * schema page-level :
 *   - buildSpeakableSpecification(cssSelectors | xpath) → propriété brute
 *   - injectSpeakableInto(schemaObj, selectors) → spread propriété sur schema
 *   - DEFAULT_SPEAKABLE_SELECTORS : CSS selectors canoniques Axion-IA
 *     (h1, [itemprop="text"] qui couvre direct-answer 40-80 mots, .speakable)
 */

interface SpeakableSpec {
  readonly "@type": "SpeakableSpecification";
  readonly cssSelector?: ReadonlyArray<string>;
  readonly xpath?: ReadonlyArray<string>;
}

/**
 * Selectors CSS par défaut Axion-IA — ciblent les éléments hautement citables
 * par les LLMs vocaux (titre + direct-answer + sections marquées explicitement).
 */
export const DEFAULT_SPEAKABLE_SELECTORS: ReadonlyArray<string> = [
  "h1",
  '[itemprop="text"]',
  ".speakable",
  ".direct-answer",
];

/**
 * Build SpeakableSpecification réutilisable pour injection dans tout schema
 * page-level (WebPage, Article, FAQPage, Service…).
 *
 * @param selectors CSS selectors. Default = DEFAULT_SPEAKABLE_SELECTORS.
 * @param xpath Alternative ou complément XPath (rarement utilisé).
 */
export function buildSpeakableSpecification(opts?: {
  selectors?: ReadonlyArray<string>;
  xpath?: ReadonlyArray<string>;
}): SpeakableSpec {
  const selectors = opts?.selectors ?? DEFAULT_SPEAKABLE_SELECTORS;
  return {
    "@type": "SpeakableSpecification",
    cssSelector: selectors,
    ...(opts?.xpath && opts.xpath.length > 0 ? { xpath: opts.xpath } : {}),
  };
}

/**
 * Inject la propriété `speakable` dans tout schema page-level.
 * Idempotent : ne réécrase pas si déjà présente.
 */
export function injectSpeakableInto<T extends Record<string, unknown>>(
  schema: T,
  selectors?: ReadonlyArray<string>,
): T & { speakable: SpeakableSpec } {
  if ("speakable" in schema && schema["speakable"] != null) {
    return schema as T & { speakable: SpeakableSpec };
  }
  return {
    ...schema,
    speakable: buildSpeakableSpecification(selectors ? { selectors } : undefined),
  };
}

/**
 * Helper "ALL-IN" : enrobe un schema page-level (Article/WebPage/Service)
 * avec Speakable universel + valide les selectors non-vides.
 *
 * Si selectors === [] → retourne le schema tel-quel (no-op safe).
 */
export function withUniversalSpeakable<T extends Record<string, unknown>>(
  schema: T,
  selectors: ReadonlyArray<string> = DEFAULT_SPEAKABLE_SELECTORS,
): T | (T & { speakable: SpeakableSpec }) {
  if (selectors.length === 0) return schema;
  return injectSpeakableInto(schema, selectors);
}
