// Sitemap dédié aux avis clients (/avis). DB-driven : hub + chaque avis publié
// (avec sa photo pour Google Images) + facettes curées (service / ville / secteur
// / département) ayant ≥ FACET_MIN_COUNT avis. FR canonique (EN désactivé).
//
// `force-dynamic` (comme sitemap-carrieres / sitemap-blog) : les avis sont 100 %
// en DB. Généré au build avec DATABASE_URL=stub → 0 avis figé. En dynamique, lit
// toujours la vraie DB au runtime → jamais figé sur le build stub.
// Référencé dans sitemap-index.xml (CUSTOM_SITEMAPS).

import { SITE_URL, SITE_EDITORIAL_DATE } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import {
  getServiceFacets,
  getCityFacets,
  getSectorFacets,
  getDepartmentFacets,
} from "@/server/reviews/queries";
import { FACET_MIN_COUNT } from "@/lib/reviews/config";
import { isServiceLine } from "@/lib/reviews/service-lines";
import { isClientSectorSlug } from "@/content/sectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlNode(loc: string, lastmod: string, priority: string, imageLoc?: string): string {
  const img = imageLoc
    ? `\n    <image:image>\n      <image:loc>${xmlEscape(imageLoc)}</image:loc>\n    </image:image>`
    : "";
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>${img}\n  </url>`;
}

export async function GET(): Promise<Response> {
  let reviews: Array<{ slug: string; updatedAt: Date; photoUrl: string | null }> = [];
  let serviceFacets: { key: string; count: number }[] = [];
  let cityFacets: { key: string; count: number }[] = [];
  let sectorFacets: { key: string; count: number }[] = [];
  let deptFacets: { key: string; count: number }[] = [];
  try {
    [reviews, serviceFacets, cityFacets, sectorFacets, deptFacets] = await Promise.all([
      prisma.customerReview.findMany({
        where: { status: "published" },
        orderBy: { publishedAt: "desc" },
        take: 5000,
        select: { slug: true, updatedAt: true, photoUrl: true },
      }),
      getServiceFacets(),
      getCityFacets(),
      getSectorFacets(),
      getDepartmentFacets(),
    ]);
  } catch (err) {
    // Fail-soft mais OBSERVABLE (un sitemap vide inaperçu = avis invisibles Google).
    console.error("[sitemap-avis] échec lecture DB:", err);
  }

  const hubLastmod =
    reviews.length > 0
      ? reviews
          .map((r) => r.updatedAt.toISOString())
          .sort()
          .at(-1)!
      : SITE_EDITORIAL_DATE;

  const urls: string[] = [];
  urls.push(urlNode(`${SITE_URL}/fr/avis`, hubLastmod, "0.8"));
  urls.push(urlNode(`${SITE_URL}/fr/avis/deposer`, SITE_EDITORIAL_DATE, "0.5"));

  for (const r of reviews) {
    const img = r.photoUrl ? `${SITE_URL}${r.photoUrl}` : undefined;
    urls.push(urlNode(`${SITE_URL}/fr/avis/${r.slug}`, r.updatedAt.toISOString(), "0.6", img));
  }

  // Facettes curées (≥ seuil) — cohérent avec le notFound() des pages facettes.
  for (const f of serviceFacets) {
    if (f.count >= FACET_MIN_COUNT && isServiceLine(f.key))
      urls.push(urlNode(`${SITE_URL}/fr/avis/service/${f.key}`, hubLastmod, "0.6"));
  }
  for (const f of cityFacets) {
    if (f.count >= FACET_MIN_COUNT)
      urls.push(urlNode(`${SITE_URL}/fr/avis/ville/${f.key}`, hubLastmod, "0.5"));
  }
  for (const f of sectorFacets) {
    if (f.count >= FACET_MIN_COUNT && isClientSectorSlug(f.key))
      urls.push(urlNode(`${SITE_URL}/fr/avis/secteur/${f.key}`, hubLastmod, "0.5"));
  }
  for (const f of deptFacets) {
    if (f.count >= FACET_MIN_COUNT)
      urls.push(urlNode(`${SITE_URL}/fr/avis/departement/${f.key}`, hubLastmod, "0.4"));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
