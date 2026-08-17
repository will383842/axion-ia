/**
 * Recherche site cross-content (2026-06-21) — étend la recherche `/recherche`
 * (V1 = KB seule) aux **articles** content-gen, aux **villes** pSEO et aux
 * **services/métiers**. Répond au besoin visiteur : chercher une ville, un mot,
 * un métier ou tout besoin et trouver le contenu pertinent partout sur le site.
 *
 * Sources agrégées :
 *   - KB      : `searchKnowledge` (FTS Postgres, `knowledge_*` public) — inchangé.
 *   - Articles: table `Article` publiés tier-1 (titre `contains`, insensitive).
 *   - Villes  : `getIndexableVilles()` (villes avec copy), match nom accent/casse-
 *               insensible → page hub `/implantations/{region}/{ville}`.
 *   - Services: `SERVICES` (nom officiel / nav) → page hub du service.
 *
 * Tout est fail-open (try/catch sur la DB) : au build stub.invalid la partie DB
 * renvoie [], la partie statique (villes/services) reste fonctionnelle.
 */
import { getIndexableVillesCore } from "@/content/villes/core";
import { SERVICES } from "@/content/services";
import { searchKnowledge, type KbSearchHit } from "@/lib/knowledge/search-fts";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n/routing";

/** Normalise pour un match casse + accents insensibles (« orleans » = « Orléans »). */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export interface SiteSearchVille {
  readonly nameFr: string;
  readonly region: string;
  readonly slug: string;
}
export interface SiteSearchService {
  readonly name: string;
  readonly href: string;
}
export interface SiteSearchArticle {
  readonly title: string;
  readonly slug: string;
}
export interface SiteSearchResults {
  readonly kb: readonly KbSearchHit[];
  readonly articles: readonly SiteSearchArticle[];
  readonly villes: readonly SiteSearchVille[];
  readonly services: readonly SiteSearchService[];
  readonly total: number;
}

function searchVilles(query: string, limit: number): SiteSearchVille[] {
  const nq = normalize(query);
  if (nq.length < 2) return [];
  return getIndexableVillesCore()
    .filter((v) => normalize(v.nameFr).includes(nq))
    .slice(0, limit)
    .map((v) => ({ nameFr: v.nameFr, region: v.region, slug: v.slug }));
}

function searchServices(query: string, locale: Locale, limit: number): SiteSearchService[] {
  const nq = normalize(query);
  if (nq.length < 2) return [];
  const isFr = locale === "fr";
  return SERVICES.filter((s) => {
    const official = normalize(isFr ? s.officialFr : s.officialEn);
    const navShort = normalize(isFr ? s.navShortFr : s.navShortEn);
    return official.includes(nq) || navShort.includes(nq);
  })
    .slice(0, limit)
    .map((s) => ({ name: isFr ? s.officialFr : s.officialEn, href: s.href }));
}

async function searchArticles(
  query: string,
  locale: Locale,
  limit: number,
): Promise<SiteSearchArticle[]> {
  if (query.trim().length < 2) return [];
  try {
    const rows = await prisma.article.findMany({
      where: {
        status: "published",
        indexationTier: "tier_1_indexable",
        isNews: false,
        translations: { some: { locale, title: { contains: query, mode: "insensitive" } } },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: { translations: { where: { locale }, take: 1, select: { slug: true, title: true } } },
    });
    return rows
      .map((r) => r.translations[0])
      .filter((t): t is { slug: string; title: string } => !!t)
      .map((t) => ({ title: t.title, slug: t.slug }));
  } catch {
    return [];
  }
}

/**
 * Recherche cross-content. Lance les sources en parallèle, fail-open par source.
 * `total` = somme des résultats RÉELLEMENT affichés (pas le total FTS brut).
 */
export async function searchSite(params: {
  query: string;
  locale: Locale;
  limit?: number;
}): Promise<SiteSearchResults> {
  const { query, locale, limit = 20 } = params;
  const [kbRes, articles] = await Promise.all([
    searchKnowledge({ query, locale, limit }).catch(() => ({
      hits: [] as KbSearchHit[],
      total: 0,
    })),
    searchArticles(query, locale, 10),
  ]);
  const villes = searchVilles(query, 8);
  const services = searchServices(query, locale, 5);
  const total = kbRes.hits.length + articles.length + villes.length + services.length;
  return { kb: kbRes.hits, articles, villes, services, total };
}
