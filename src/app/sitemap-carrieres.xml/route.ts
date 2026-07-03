// Sitemap dédié aux offres d'emploi (/carrieres). DB-driven : n'émet que les
// offres publiées, non pourvues, tier_1 et non expirées. lastmod = updatedAt de
// l'offre. Inclut les images (Google Images — sitemap-image 1.1). Référencé dans
// sitemap-index.xml (CUSTOM_SITEMAPS). FR canonique (EN désactivé).
//
// `force-dynamic` (2026-07-03) : ce sitemap est DB-driven ET rarement visité.
// Avec `revalidate`, la version générée AU BUILD (DATABASE_URL=stub → 0 offre)
// restait figée et servie à Google → les 45 offres étaient absentes du sitemap
// (bug d'indexation). En dynamique, il lit toujours la vraie DB au runtime, donc
// jamais figé sur le build stub.

import { SITE_URL, SITE_EDITORIAL_DATE } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { careerImage } from "@/content/careers/careers-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Échappe les entités XML — les URLs Unsplash contiennent des `&` (query string). */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  let rows: Array<{ slug: string; updatedAt: Date; validThrough: Date | null }> = [];
  try {
    rows = await prisma.jobOffer.findMany({
      where: { status: "published", filledAt: null, indexationTier: "tier_1_indexable" },
      select: { slug: true, updatedAt: true, validThrough: true },
    });
  } catch (err) {
    // Fail-soft (build stub / hoquet DB) mais OBSERVABLE : on LOG au lieu d'avaler
    // silencieusement — un sitemap vide passé inaperçu = offres invisibles pour Google.
    console.error("[sitemap-carrieres] jobOffer.findMany a échoué:", err);
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
    const imgLoc = xmlEscape(careerImage(o.slug).url);
    urls.push(
      `  <url>\n    <loc>${SITE_URL}/fr/carrieres/${o.slug}</loc>\n    <lastmod>${o.updatedAt.toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n    <image:image>\n      <image:loc>${imgLoc}</image:loc>\n    </image:image>\n  </url>`,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
