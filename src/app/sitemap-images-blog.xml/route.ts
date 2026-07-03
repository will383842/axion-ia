// Sitemap Google Image 1.1 — images des ARTICLES de blog (audit maillage/indexation
// 2026-07-03). Comble le seul manque images identifié : les visuels d'articles
// (Article.featuredImage) n'étaient annoncés dans AUCUN sitemap image (galerie,
// pages services et bannières villes étaient couvertes ; pas le blog).
//
// Route Handler XML brut (le namespace image: n'est pas supporté par la
// convention Next 16 metadata), modelé sur `app/sitemaps/images-fr.xml`.
// Référencé dans `app/sitemap-index.xml` (CUSTOM_SITEMAPS).
//
// Portée : articles publiés tier-1 (isNews=false) ayant une featuredImage. FR
// uniquement (EN désactivé 301→FR). Route par type : guide-* → /guides, sinon
// /blog (parité avec le routage href du reste du site). Image absolue : URL
// externe (héros Unsplash) telle quelle, sinon préfixée par SITE_URL.
//
// Fail-soft + stub-safe (ADR 0026) : XML vide valide si DB absente / build stub.

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { escapeXml } from "@/server/image-bank/utils/xml";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const MAX_URLS = 1000;

interface Row {
  featuredImage: string | null;
  featuredImageAltFr: string | null;
  updatedAt: Date;
  publishedAt: Date | null;
  translations: Array<{ slug: string; title: string }>;
}

async function fetchArticles(): Promise<Row[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return [];
  try {
    return await prisma.article.findMany({
      where: {
        status: "published",
        isNews: false,
        indexationTier: "tier_1_indexable",
        featuredImage: { not: null },
      },
      select: {
        featuredImage: true,
        featuredImageAltFr: true,
        updatedAt: true,
        publishedAt: true,
        translations: { where: { locale: "fr" }, select: { slug: true, title: true }, take: 1 },
      },
      orderBy: { publishedAt: "desc" },
      take: MAX_URLS,
    });
  } catch {
    return [];
  }
}

/** URL absolue de l'image : externe (Unsplash) telle quelle, sinon SITE_URL + path. */
function absoluteImage(src: string): string {
  return src.startsWith("http") ? src : `${SITE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
}

export async function GET(): Promise<Response> {
  const rows = await fetchArticles();
  const urlBlocks: string[] = [];

  for (const a of rows) {
    const tr = a.translations[0];
    if (!tr?.slug || !a.featuredImage) continue;
    const segment = tr.slug.startsWith("guide-") ? "guides" : "blog";
    const pageUrl = `${SITE_URL}/fr/${segment}/${tr.slug}`;
    const imageUrl = absoluteImage(a.featuredImage);
    const lastmod = (a.updatedAt ?? a.publishedAt ?? new Date(0)).toISOString();
    const title = escapeXml(a.featuredImageAltFr ?? tr.title);

    urlBlocks.push(
      `  <url>
    <loc>${pageUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${title}</image:caption>
    </image:image>
  </url>`,
    );
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
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
