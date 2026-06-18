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
): "article" | "guide" | "landing" | "faq" | "comparison" {
  if (slug === "guide_pilier") return "guide";
  if (slug === "landing_ville") return "landing";
  if (slug === "faq_geo" || slug === "faq_standalone" || slug === "qa_derived") return "faq";
  if (slug === "comparison" || slug === "vs_comparator" || slug === "alternative_to")
    return "comparison";
  return "article";
}
