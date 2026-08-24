// Template : src/app/sitemap-images-en.xml/route.ts
//
// Sitemap Google Image 1.1 — variant EN.
// 99 % identique à `sitemap-images-fr.xml/route.ts` mais LANG = "en".
// Voir doc complète dans ce fichier-là.

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

import {
  CACHE_TAGS,
  DEFAULT_LICENSE_URL,
  GALLERY_SEGMENT,
  LOCALE_BCP47,
  SITEMAP_CACHE_HEADER,
  SITEMAP_CHUNK_SIZE,
} from "@/server/image-bank/constants";
import { escapeXml } from "@/lib/xml";
import { absoluteUrl, pageUrlFor } from "@/server/image-bank/utils/paths";

const LANG = "en" as const;
const OTHER_LANG = "fr" as const;
const MAX_URLS = SITEMAP_CHUNK_SIZE;

export const dynamic = "force-dynamic";
export const revalidate = 3600;

// V-11 sprint UX 2026-05-22 — quand EN locale désactivé (AGENTS.md §EN locale
// désactivé 2026-05-16), retourner sitemap vide pour éviter de déclarer des URLs
// /en/gallery/ qui sont 301 vers /fr/galerie/ (gap audit V-11 P1-2 résolu).
const EN_LOCALE_ENABLED = process.env["EN_LOCALE_ENABLED"] === "true";

function emptySitemapResponse(): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
</urlset>
`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_HEADER,
      "X-Sitemap-Tag": CACHE_TAGS.sitemap,
      "X-Sitemap-Disabled-Reason": "en-locale-disabled",
    },
  });
}

interface ImageRow {
  filePath: string;
  geoPlacename: string | null;
  licenseUrl: string | null;
  updatedAt: Date;
  publishedAt: Date | null;
  createdAt: Date;
  translations: Array<{
    languageCode: string;
    slug: string;
    title: string;
    alt: string;
    caption: string | null;
  }>;
}

async function fetchPublishedImages(): Promise<ImageRow[]> {
  // P2-SITEMAP-1 audit V1 verification 2026-05-16 — early-exit explicite
  // cohérence doctrine AGENTS.md / ADR 0026 (pattern knowledge-rss.ts).
  // Le Proxy Prisma couvre déjà `findMany` au build, on l'évite tout court.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  try {
    return await prisma.imageAsset.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        publishedAt: { not: null },
        translations: { some: { languageCode: LANG, isPublished: true } },
      },
      include: {
        translations: {
          where: { isPublished: true },
          select: {
            languageCode: true,
            slug: true,
            title: true,
            alt: true,
            caption: true,
          },
        },
      },
      orderBy: { publishedAt: "desc" },
      take: MAX_URLS,
    });
  } catch {
    return [];
  }
}

export async function GET(): Promise<Response> {
  if (!EN_LOCALE_ENABLED) {
    return emptySitemapResponse();
  }
  const rows = await fetchPublishedImages();

  const urlBlocks: string[] = [];

  const indexUrl = `${SITE_URL}/${LANG}/${GALLERY_SEGMENT[LANG]}/`;
  const indexUrlOther = `${SITE_URL}/${OTHER_LANG}/${GALLERY_SEGMENT[OTHER_LANG]}/`;
  urlBlocks.push(
    `  <url>
    <loc>${indexUrl}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
    <xhtml:link rel="alternate" hreflang="${LOCALE_BCP47[LANG]}" href="${indexUrl}" />
    <xhtml:link rel="alternate" hreflang="${LOCALE_BCP47[OTHER_LANG]}" href="${indexUrlOther}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${indexUrlOther}" />
  </url>`,
  );

  for (const image of rows) {
    const langTr = image.translations.find((t) => t.languageCode === LANG);
    if (!langTr) continue;

    const pageUrl = pageUrlFor(SITE_URL, LANG, langTr.slug);
    const imageUrl = absoluteUrl(SITE_URL, image.filePath);
    const lastmod = (image.updatedAt ?? image.publishedAt ?? image.createdAt).toISOString();

    const hreflang: string[] = [];
    for (const tr of image.translations) {
      const url = pageUrlFor(SITE_URL, tr.languageCode as "fr" | "en", tr.slug);
      const code = LOCALE_BCP47[tr.languageCode as "fr" | "en"] ?? tr.languageCode;
      hreflang.push(`<xhtml:link rel="alternate" hreflang="${code}" href="${url}" />`);
    }
    const frTr = image.translations.find((t) => t.languageCode === "fr");
    if (frTr) {
      hreflang.push(
        `<xhtml:link rel="alternate" hreflang="x-default" href="${pageUrlFor(SITE_URL, "fr", frTr.slug)}" />`,
      );
    }

    const captionXml = escapeXml(langTr.caption ?? langTr.alt);
    const geoXml = image.geoPlacename
      ? `<image:geo_location>${escapeXml(image.geoPlacename)}</image:geo_location>`
      : "";

    urlBlocks.push(
      `  <url>
    <loc>${pageUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <image:image>
      <image:loc>${imageUrl}</image:loc>
      <image:title>${escapeXml(langTr.title)}</image:title>
      <image:caption>${captionXml}</image:caption>
      ${geoXml}
      <image:license>${image.licenseUrl ?? DEFAULT_LICENSE_URL}</image:license>
    </image:image>
    ${hreflang.join("\n    ")}
  </url>`,
    );
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
${urlBlocks.join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_HEADER,
      "X-Sitemap-Tag": CACHE_TAGS.sitemap,
    },
  });
}
