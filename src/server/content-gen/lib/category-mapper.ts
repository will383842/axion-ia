// Mapping ServiceSector → catégorie de blog (catégorisation content-gen 2026-06-16).
// Les 5 catégories sont créées par la migration 20260616180000_content_gen_categorization.
// Le serviceSector du job (propagé depuis la campagne) détermine la catégorie de
// l'article à la publication (content-publish-worker).
import { prisma } from "@/lib/prisma";
import type { ServiceSector } from "../../../../prisma/generated/client";

/** Slug stable de catégorie de blog pour chaque secteur de service. */
export const SECTOR_TO_CATEGORY_SLUG: Record<ServiceSector, string> = {
  interventions_formations: "blog-formations-ia",
  un_a_un: "blog-coaching-1-to-1",
  audits: "blog-audits-ia",
  implementations: "blog-implementations-ia",
  sites_web_augmentes: "blog-sites-web-augmentes",
};

/** Tous les slugs de catégories de blog content-gen (pour les pages hub/catégorie). */
export const BLOG_CATEGORY_SLUGS: ReadonlyArray<string> = Object.values(SECTOR_TO_CATEGORY_SLUG);

/**
 * Labels STATIQUES des 5 catégories (doivent matcher name_fr/name_en de la
 * migration 20260616180000). Utilisés par les pages catégorie pour résoudre le
 * label SANS requête DB — indispensable car au build (DATABASE_URL=stub.invalid)
 * les requêtes DB renvoient vide (cf. ADR 0026), ce qui ferait un notFound/404.
 */
export const BLOG_CATEGORY_LABELS: Record<string, { readonly fr: string; readonly en: string }> = {
  "blog-formations-ia": { fr: "Formations IA", en: "AI Training" },
  "blog-coaching-1-to-1": { fr: "Coaching 1-to-1", en: "One-on-one Coaching" },
  "blog-audits-ia": { fr: "Audits IA", en: "AI Audits" },
  "blog-implementations-ia": {
    fr: "Implémentation & automatisation IA",
    en: "AI implementation & automation",
  },
  "blog-sites-web-augmentes": { fr: "Sites web & SaaS IA", en: "AI Websites & SaaS" },
};

export function blogCategoryLabel(slug: string, locale: "fr" | "en"): string | null {
  const l = BLOG_CATEGORY_LABELS[slug];
  return l ? l[locale] : null;
}

export function categorySlugForSector(sector: ServiceSector | null | undefined): string | null {
  if (!sector) return null;
  return SECTOR_TO_CATEGORY_SLUG[sector] ?? null;
}

/**
 * Résout l'id de catégorie DB pour un secteur. Retourne null si secteur absent
 * ou catégorie introuvable (fail-soft : l'article se publie sans catégorie).
 */
export async function resolveCategoryIdForSector(
  sector: ServiceSector | null | undefined,
): Promise<string | null> {
  const slug = categorySlugForSector(sector);
  if (!slug) return null;
  const cat = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  return cat?.id ?? null;
}
