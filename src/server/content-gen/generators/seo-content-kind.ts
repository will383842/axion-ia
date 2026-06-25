/**
 * Content Generator — Mapping ContentType (slug) → contentKind du SEO scorer.
 * Module PUR (aucune dépendance) pour être importable par les générateurs ET la
 * notation qualité centralisée sans tirer de deps lourdes.
 *
 * Le contentKind ajuste les seuils du scorer (notamment la cible de longueur).
 * Sans ça, les types étaient tous notés "article" (cible 800), pénalisant les
 * formats volontairement courts (FAQ) ou longs (guides/landing).
 */
export function seoContentKind(
  slug: string,
): "article" | "guide" | "landing" | "faq" | "comparison" | "news" {
  if (slug === "guide_pilier") return "guide";
  if (slug === "landing_ville") return "landing";
  if (slug === "faq_geo" || slug === "faq_standalone" || slug === "qa_derived") return "faq";
  if (slug === "comparison" || slug === "vs_comparator" || slug === "alternative_to")
    return "comparison";
  // Digest RSS d'actualité : conçu court (≈550 mots, calé sur la matière
  // source). Noté sur la cible "news" (550) plutôt que "article" (800) pour
  // refléter sa longueur appropriée — sinon word-count 0/10 à tort.
  if (slug === "blog_from_rss") return "news";
  return "article";
}
