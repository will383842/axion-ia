// Sitemap dédié au module recrutement commercial (devenir-commercial-ia).
// Route Handler XML brut isolé — ne touche PAS au sitemap.ts principal (17k
// routes). Référencé dans `sitemap-index.xml` (CUSTOM_SITEMAPS).
//
// Émet : page France générique + candidature + les ~40 hubs INDEXABLES (ceux
// qui ont des données locales riches). Les villes satellites T3/T4 NE sont PAS
// dans le sitemap (elles font un 301 vers leur hub). Au fur et à mesure que
// l'economic-data des hubs « thin » est enrichie, l'ISR (revalidate 24h) les
// ajoute automatiquement — sans deploy.
//
// FR canonique uniquement (EN désactivé 2026-05-16 → 301, hors crawl budget).

import { SITE_URL } from "@/lib/seo";
import { getHubSlugs } from "@/content/recrutement/satellites";
import { getVille } from "@/content/villes";

export const dynamic = "force-static";
export const revalidate = 86400;

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Gate d'indexation indépendant : hub indexable = secteurs locaux réels présents. */
function isIndexableHub(slug: string): boolean {
  const v = getVille(slug);
  return !!v?.economicData?.topSectorsNaf?.length;
}

function lastmod(): string {
  const iso = process.env.BUILD_TIME;
  if (iso) {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

export async function GET(): Promise<Response> {
  const lm = lastmod();
  const entries: Array<{ path: string; priority: string; freq: string }> = [
    { path: "/devenir-commercial-ia", priority: "0.8", freq: "weekly" },
    { path: "/devenir-commercial-ia/candidature", priority: "0.7", freq: "monthly" },
  ];
  for (const slug of getHubSlugs()) {
    if (isIndexableHub(slug)) {
      entries.push({ path: `/devenir-commercial-ia/${slug}`, priority: "0.7", freq: "weekly" });
    }
  }

  const urls = entries
    .map((e) => {
      const loc = `${SITE_URL}/fr${escapeXml(e.path)}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lm}</lastmod>\n    <changefreq>${e.freq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
