// Résolution de la route publique d'un article content-gen selon son type
// (multi-types route-aware, 2026-06-16). Dérive la route des champs existants de
// l'Article (isNews + templateVariant) — zéro nouvelle colonne.
//   - isNews=true                       → /actualites/[slug]
//   - templateVariant contient "guide"  → /guides/[slug]
//   - sinon (blog_article, comparison, pain_point, what_is_x, faq, qa, etc.) → /blog/[slug]
// (glossary_term n'est PAS un Article — route via KnowledgeEntry /glossaire ;
//  faq_standalone est un Article rendu via /blog.)
export type ArticleRouteSegment = "blog" | "actualites" | "guides";

export function resolveArticleRoute(article: {
  readonly isNews?: boolean | null;
  readonly templateVariant?: string | null;
}): ArticleRouteSegment {
  if (article.isNews === true) return "actualites";
  if ((article.templateVariant ?? "").toLowerCase().includes("guide")) return "guides";
  return "blog";
}
