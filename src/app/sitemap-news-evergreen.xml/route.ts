// Sitemap « news evergreen » — découverte long-tail des actualités IA vieillies.
//
// PROBLÈME résolu (audit maillage/indexation 2026-07-03) : les Articles
// `isNews=true` n'apparaissent QUE dans `app/sitemap-news.xml/route.ts`, dont la
// fenêtre Google News est STRICTE (48h). Passé 48h, ces actus disparaissent de
// TOUS les sitemaps XML : le sub-sitemap blog (`sitemap.ts` → `buildBlogSitemap`)
// exclut explicitement `isNews:true`. Résultat : des actus indexables mais âgées
// de > 48h ne sont plus découvrables par aucun sitemap (crawl-orphelines).
//
// SOLUTION : ce sub-sitemap émet un `<urlset>` STANDARD (PAS le namespace
// `xmlns:news` — ce n'est pas pour Google News mais pour la découverte organique
// long-tail) couvrant les actus `tier_1_indexable` publiées dans les ~90 derniers
// jours. Il prolonge la fenêtre de découverte bien au-delà des 48h de Google News
// sans jamais dupliquer/contredire le sitemap-news (namespaces + finalités
// distincts). Passé 90 jours, l'actu reste LIVE + indexable (pas de noindex) ;
// elle n'est simplement plus annoncée ici (crawl-budget concentré sur le récent).
//
// Route Handler XML brut (la convention Next 16 `MetadataRoute.Sitemap` reste
// utilisable ici, mais on reste homogène avec les autres sub-sitemaps custom DB-
// driven — `sitemap-images-blog.xml`, `sitemap-carrieres.xml` — pour partager le
// même garde stub.invalid + le même shaping XML). Référencé dans
// `app/sitemap-index.xml` (CUSTOM_SITEMAPS).
//
// Portée : Articles `isNews=true`, `status='published'`, `tier_1_indexable`,
// `publishedAt >= now - 90j`. FR uniquement (EN désactivé 301→FR). URL canonique
// `${SITE_URL}/fr/actualites/${slug}`.
//
// Fail-soft + stub-safe (ADR 0026) : `<urlset>` vide valide si DB absente / build
// stub (le garde `stub.invalid` retourne [] avant même le call Prisma).

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { escapeXml } from "@/server/image-bank/utils/xml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600;

// Fenêtre evergreen : ~90 jours (bien au-delà des 48h Google News). Au-delà,
// l'actu reste indexable mais sort de ce sitemap (crawl-budget concentré).
const EVERGREEN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

// Cap défensif (best-practice ≤ 1000 URLs/sub-sitemap, cohérent avec les autres
// sub-sitemaps custom). ~90 jours d'actus IA restent très en-dessous de ce cap.
const MAX_URLS = 1000;

interface Row {
  publishedAt: Date | null;
  updatedAt: Date;
  translations: Array<{ slug: string }>;
}

async function fetchRecentNews(): Promise<Row[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return [];
  const cutoff = new Date(Date.now() - EVERGREEN_WINDOW_MS);
  try {
    return await prisma.article.findMany({
      where: {
        status: "published",
        isNews: true,
        indexationTier: "tier_1_indexable",
        publishedAt: { gte: cutoff },
      },
      select: {
        publishedAt: true,
        updatedAt: true,
        translations: { where: { locale: "fr" }, select: { slug: true }, take: 1 },
      },
      orderBy: { publishedAt: "desc" },
      take: MAX_URLS,
    });
  } catch {
    // P2021 (table absente bootstrap) / hoquet DB — fail-soft XML vide valide.
    return [];
  }
}

export async function GET(): Promise<Response> {
  const rows = await fetchRecentNews();
  const urlBlocks: string[] = [];

  for (const row of rows) {
    const t = row.translations[0];
    if (!t?.slug) continue;
    const loc = escapeXml(`${SITE_URL}/fr/actualites/${t.slug}`);
    // lastmod = updatedAt (fraîcheur réelle), fallback publishedAt.
    const lastmod = (row.updatedAt ?? row.publishedAt ?? new Date(0)).toISOString();
    urlBlocks.push(
      `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`,
    );
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlBlocks.join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
