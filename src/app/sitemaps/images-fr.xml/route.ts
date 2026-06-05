// Template : src/app/sitemap-images-fr.xml/route.ts
//
// Sitemap Google Image 1.1 — Route Handler XML brut.
//
// Pourquoi un Route Handler custom et pas `app/sitemap.ts` :
//   La convention Next 16 metadata `MetadataRoute.Sitemap` ne supporte pas
//   le namespace `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`
//   requis par Google Image Sitemap. Sans ce namespace + les balises
//   `<image:image>`, Google n'enrichit pas l'indexation Images.
//   Pattern identique à `app/sitemap-news.xml/route.ts` (audit Sitemap+IndexNow
//   2026-05-15 AGENT 4 §4.1.3 P0-3).
//
// Référencé manuellement dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).
//
// Spec Google Image Sitemap 1.1 :
//   https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
//   - `<image:loc>` URL absolue de l'image (obligatoire)
//   - `<image:title>` (recommandé)
//   - `<image:caption>` (recommandé)
//   - `<image:geo_location>` (optionnel)
//   - `<image:license>` (recommandé — active le badge « Licensable » Google Images)
//   - Cap 1 000 images / URL parent, 50 000 URLs / sitemap, 50 MB / fichier non-compressé.
//
// Fail-soft : si table `image_assets` absente (P2021 bootstrap) ou aucune image
// publiée → XML vide valide (sitemap-index ignore proprement).

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
import { escapeXml } from "@/server/image-bank/utils/xml";
import { absoluteUrl, pageUrlFor } from "@/server/image-bank/utils/paths";

const LANG = "fr" as const;
const OTHER_LANG = "en" as const;

// Audit GSC 2026-06-05 A-04 (Invariant #1) — ce Route Handler XML brut ne passe pas
// par `filterEnIfDisabled` (app/sitemap.ts). Sans ce garde, il émettait des
// `hreflang="en"` vers /en/gallery/* alors que EN est désactivé (301→FR), créant
// une fuite EN dans un signal d'indexation. On conditionne donc toute émission EN
// au flag. Togglable : EN_LOCALE_ENABLED=true ré-émet les alternates EN.
const EN_ENABLED = process.env["EN_LOCALE_ENABLED"] === "true";

// Cap soft 1 000 URLs/chunk (best practice 2026, cf. `app/sitemap.ts`).
// Chunking explicit non implémenté V1 (volume galerie attendu < 1 000).
// V1.5+ : si volume > 1 000 → activer chunking dynamique
// `sitemap-images-fr-1.xml`, `-2.xml`... via dossier dynamique `[chunk]/`.
const MAX_URLS = SITEMAP_CHUNK_SIZE;

// `force-dynamic` (volume galerie variable + revalidateTag depuis admin actions).
// Cache CDN 1h derrière Cloudflare via `Cache-Control` header.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

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
  // cohérence doctrine AGENTS.md / ADR 0026 (pattern knowledge-rss.ts +
  // knowledge-sitemap.ts). Le Proxy Prisma `src/lib/prisma.ts` couvre
  // déjà `findMany` au build GH Actions (retourne `[]`), mais on évite
  // même l'instanciation lazy du client pour clarté.
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
    // P2021 (table absente bootstrap) — fail-soft XML vide
    return [];
  }
}

export async function GET(): Promise<Response> {
  const rows = await fetchPublishedImages();

  const urlBlocks: string[] = [];

  // Index galerie (page liste)
  const indexUrl = `${SITE_URL}/${LANG}/${GALLERY_SEGMENT[LANG]}/`;
  const indexUrlOther = `${SITE_URL}/${OTHER_LANG}/${GALLERY_SEGMENT[OTHER_LANG]}/`;
  const indexAlternates = [
    `<xhtml:link rel="alternate" hreflang="${LOCALE_BCP47[LANG]}" href="${indexUrl}" />`,
    // A-04 : alternate EN émis seulement si EN réactivé (sinon fuite vers 301).
    ...(EN_ENABLED
      ? [
          `<xhtml:link rel="alternate" hreflang="${LOCALE_BCP47[OTHER_LANG]}" href="${indexUrlOther}" />`,
        ]
      : []),
    `<xhtml:link rel="alternate" hreflang="x-default" href="${indexUrl}" />`,
  ];
  urlBlocks.push(
    `  <url>
    <loc>${indexUrl}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
    ${indexAlternates.join("\n    ")}
  </url>`,
  );

  for (const image of rows) {
    const langTr = image.translations.find((t) => t.languageCode === LANG);
    if (!langTr) continue;

    const pageUrl = pageUrlFor(SITE_URL, LANG, langTr.slug);
    const imageUrl = absoluteUrl(SITE_URL, image.filePath);
    const lastmod = (image.updatedAt ?? image.publishedAt ?? image.createdAt).toISOString();

    // Hreflang alternates pour toutes les translations publiées de cette image
    const hreflang: string[] = [];
    for (const tr of image.translations) {
      // A-04 : ne pas émettre d'alternate EN quand EN est désactivé (fuite → 301).
      if (!EN_ENABLED && tr.languageCode !== "fr") continue;
      const url = pageUrlFor(SITE_URL, tr.languageCode as "fr" | "en", tr.slug);
      const code = LOCALE_BCP47[tr.languageCode as "fr" | "en"] ?? tr.languageCode;
      hreflang.push(`<xhtml:link rel="alternate" hreflang="${code}" href="${url}" />`);
    }
    // x-default = FR si dispo
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
