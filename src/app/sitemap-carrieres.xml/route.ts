// Sitemap dédié aux offres d'emploi (/carrieres). DB-driven (≠ recrutement qui
// est force-static) : n'émet que les offres publiées, non pourvues, tier_1 et
// non expirées. lastmod = updatedAt de l'offre. Stub-safe au build (prisma → []).
// Référencé dans sitemap-index.xml (CUSTOM_SITEMAPS). FR canonique (EN désactivé).

import { SITE_URL, SITE_EDITORIAL_DATE } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  let rows: Array<{ slug: string; updatedAt: Date; validThrough: Date | null }> = [];
  try {
    rows = await prisma.jobOffer.findMany({
      where: { status: "published", filledAt: null, indexationTier: "tier_1_indexable" },
      select: { slug: true, updatedAt: true, validThrough: true },
    });
  } catch {
    rows = [];
  }
  const now = Date.now();
  const offers = rows.filter((r) => !r.validThrough || r.validThrough.getTime() >= now);

  const hubLastmod =
    offers.length > 0
      ? offers
          .map((o) => o.updatedAt.toISOString())
          .sort()
          .at(-1)!
      : SITE_EDITORIAL_DATE;

  const urls: string[] = [];
  urls.push(
    `  <url>\n    <loc>${SITE_URL}/fr/carrieres</loc>\n    <lastmod>${hubLastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
  );
  for (const o of offers) {
    urls.push(
      `  <url>\n    <loc>${SITE_URL}/fr/carrieres/${o.slug}</loc>\n    <lastmod>${o.updatedAt.toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
