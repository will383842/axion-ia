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

/**
 * URL absolue de l'image, TOUJOURS servie par notre domaine.
 *
 * 🔴 GEO-101 (audit GEO/AEO 2026-08-14) — mesuré en production le 2026-08-16 :
 * **133 `<image:loc>` sur 133** pointaient `images.unsplash.com`. Le corpus
 * éditorial cédait donc l'intégralité de sa valeur d'indexation image à un hôte
 * tiers : c'est unsplash.com qui capitalisait les impressions Google Images de
 * nos articles, pas axion-ia.com.
 *
 * Les images distantes passent désormais par l'optimiseur du domaine, qui est
 * exactement ce que le DOM affiche déjà. Trois conditions vérifiées avant de
 * poser ce correctif :
 *   1. `images.unsplash.com` est autorisé dans `images.remotePatterns` — sans
 *      quoi l'optimiseur répondrait 400 ;
 *   2. `Allow: /_next/image` est présent dans les douze blocs de `robots.txt` —
 *      sans quoi on déclarerait une URL interdite au crawl ;
 *   3. essai réel en production sur une des 133 URLs :
 *      `GET /_next/image?url=…&w=1200&q=75` → **200, image/jpeg, 44 Ko**.
 *
 * `w=1200` et non 1080 : c'est le plancher de Google Discover, que les sources
 * Unsplash (`w=1080`) ne franchissaient pas.
 *
 * ⚠️ Aucune `<image:license>` n'est émise par ce sitemap, et il ne faut PAS en
 * ajouter : ces photos sont des tierces (GEO-037). Les servir depuis notre
 * domaine ne nous en donne pas les droits.
 */
const LARGEUR_DECLAREE = 1200;

function absoluteImage(src: string): string {
  if (!src.startsWith("http")) {
    return `${SITE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
  }
  return `${SITE_URL}/_next/image?url=${encodeURIComponent(src)}&w=${LARGEUR_DECLAREE}&q=75`;
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
