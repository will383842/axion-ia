/**
 * KB-6 — Feature flag pour bascule progressive legacy → KnowledgeEntry.
 *
 * Lit `process.env.KB_BACKEND_UNIFIED`.
 * - "1" / "true" : les pages publiques lisent depuis `KnowledgeEntry`.
 * - autre / unset : les pages publiques lisent depuis les tables legacy
 *   (`articles`, `case_studies`, `faqs`, `help_articles`, glossaire hardcode).
 *
 * Permet rollback chirurgical sans toucher au code : il suffit d'unset l'env var
 * et de redéployer. Aucun risque SEO/perte de contenu.
 *
 * Volontairement granulaire par type (ex `KB_BACKEND_UNIFIED_BLOG=1`,
 * `KB_BACKEND_UNIFIED_FAQ=1`...) pour permettre activation type par type.
 * Un master switch `KB_BACKEND_UNIFIED=1` active tout d'un coup.
 */

export type KbBackendTarget =
  "article" | "case_study" | "faq" | "help_article" | "glossary_term" | "guide";

function readEnvFlag(name: string): boolean {
  const v = process.env[name];
  return v === "1" || v === "true";
}

/** Master switch : tout est unifié. */
export function isKbBackendUnifiedGlobal(): boolean {
  return readEnvFlag("KB_BACKEND_UNIFIED");
}

/** Per-type override : active KB seulement pour un type donné. */
export function isKbBackendUnifiedFor(target: KbBackendTarget): boolean {
  if (isKbBackendUnifiedGlobal()) return true;
  const envByTarget: Record<KbBackendTarget, string> = {
    article: "KB_BACKEND_UNIFIED_BLOG",
    case_study: "KB_BACKEND_UNIFIED_CASE_STUDIES",
    faq: "KB_BACKEND_UNIFIED_FAQ",
    help_article: "KB_BACKEND_UNIFIED_HELP",
    glossary_term: "KB_BACKEND_UNIFIED_GLOSSARY",
    guide: "KB_BACKEND_UNIFIED_GUIDE",
  };
  return readEnvFlag(envByTarget[target]);
}
