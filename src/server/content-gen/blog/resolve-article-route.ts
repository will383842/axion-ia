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

/**
 * Un slug d'article est-il ROUTABLE ? Les routes publiques `/blog/[slug]`,
 * `/actualites/[slug]`, `/guides/[slug]` sont des segments dynamiques UNIQUES :
 * un slug contenant `/` (ex. `glossaire/formation-ia-maurepas`) produit une URL
 * à deux segments qui ne matche AUCUNE route → 404 dur (et « indexation refusée »
 * si l'URL a fui dans le sitemap). Cf. incident GSC 2026-07-11.
 *
 * ⚠️ Garde-fou : tout consommateur qui construit une URL d'article ou l'expose
 * (sitemap, liens hub/catégorie, index blog) DOIT écarter les slugs non routables
 * — un slug à slash est une donnée malformée, pas une page. Correctif définitif =
 * slug plat en DB ; ce filtre évite juste de servir un 404 à Google en attendant.
 */
export function isRoutableArticleSlug(slug: string | null | undefined): boolean {
  return typeof slug === "string" && slug.length > 0 && !slug.includes("/");
}
