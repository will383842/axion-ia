// Résolution de la route publique d'un article content-gen selon son type
// (multi-types route-aware, 2026-06-16). Dérive la route des champs existants de
// l'Article (isNews + templateVariant + slug) — zéro nouvelle colonne.
//   - isNews=true                            → /actualites/[slug]
//   - slug `guide-`/`guide_` OU templateVariant contient "guide" → /guides/[slug]
//   - sinon (blog_article, comparison, pain_point, what_is_x, faq, qa, etc.) → /blog/[slug]
// (glossary_term n'est PAS un Article — route via KnowledgeEntry /glossaire ;
//  faq_standalone est un Article rendu via /blog.)
//
// ⚠️ La détection guide DOIT rester le miroir EXACT de `isGuideArticle`
// (src/server/content-gen/guides/loader.ts) : c'est ce loader qui décide quel
// Article est servi sous /guides. Or `templateVariant` = `ContentGenJob.templateId`
// (cuid de template console, qui ne contient ~jamais "guide") → sans le test de
// slug, un guide de campagne (slug `guide-…`) était listé/lié sous /blog tout en
// étant servi sous /guides = URL dupliquée indexable. Le test de slug réaligne.
export type ArticleRouteSegment = "blog" | "actualites" | "guides";

export function resolveArticleRoute(article: {
  readonly isNews?: boolean | null;
  readonly templateVariant?: string | null;
  readonly slug?: string | null;
}): ArticleRouteSegment {
  if (article.isNews === true) return "actualites";
  const slug = article.slug ?? "";
  if (slug.startsWith("guide-") || slug.startsWith("guide_")) return "guides";
  if ((article.templateVariant ?? "").toLowerCase().includes("guide")) return "guides";
  return "blog";
}
