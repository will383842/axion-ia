// Sub-sitemap presse DB-aware — Route Handler XML brut, calculé AU RUNTIME.
//
// Pourquoi un Route Handler dédié et PAS la convention metadata
// `app/sitemap.ts` (`generateSitemaps()`) :
//   Audit indexation GSC 2026-07-31 (contrôle live) — l'index listait
//   `/sitemap/presse.xml` (le gate anti-vide interroge la vraie DB au runtime,
//   qui contient ≥ 1 communiqué publié) pendant que la ROUTE metadata servait
//   un `<urlset>` VIDE : pré-rendue au build GH Actions sous
//   `DATABASE_URL=...stub.invalid` (ADR 0026), bakée vide dans l'image et
//   resservie jusqu'à la 1re revalidation ISR (`revalidate=86400`). Comme les
//   deploys sont plus fréquents que 24 h, la fenêtre se réinitialisait — c'est
//   EXACTEMENT le bug déjà corrigé pour blog/knowledge/news le 2026-07-06
//   (« Balise XML manquante : url » côté GSC).
//
//   Même remède : lecture DB AU RUNTIME (`force-dynamic`, vraie DATABASE_URL
//   Coolify), cache CDN `s-maxage=600`, ZÉRO duplication — on réutilise le
//   builder existant via le default export de `app/sitemap.ts`
//   (`sitemap({ id: "presse" })`) et on ne fait ici QUE sérialiser en XML.
//
// Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS), gaté
// anti-vide sur `presseEmittableCount` — cohérence index↔route garantie car
// les deux appellent le MÊME builder. L'ID `presse` est retiré de
// `generateSitemaps()` (l'ancien `/sitemap/presse.xml` n'est plus émis).

import sitemap from "@/app/sitemap";

// Rendu DYNAMIQUE au runtime (cf. en-tête). Volontairement PAS `force-static` :
// la version pré-rendue au build stub.invalid serait vide (bug d'origine).
export const dynamic = "force-dynamic";
export const revalidate = 600;

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function lastmodIso(lastModified: unknown): string {
  if (lastModified instanceof Date) return lastModified.toISOString();
  if (typeof lastModified === "string") return lastModified;
  return new Date(0).toISOString();
}

export async function GET(): Promise<Response> {
  // Réutilise le builder presse existant (default export metadata sitemap). Le
  // filtrage EN (`filterEnIfDisabled`) et les alternates hreflang sont déjà
  // appliqués côté builder → on sérialise tel quel.
  const entries = await sitemap({ id: Promise.resolve("presse") });

  const urlBlocks: string[] = [];
  for (const e of entries) {
    const loc = escapeXml(e.url);
    const lastmod = lastmodIso(e.lastModified);
    const changefreq = e.changeFrequency ?? "monthly";
    const priority = typeof e.priority === "number" ? e.priority.toFixed(1) : "0.5";

    const langs = e.alternates?.languages ?? {};
    const alternateLinks = Object.entries(langs)
      .filter(([, href]) => typeof href === "string" && href.length > 0)
      .map(
        ([hreflang, href]) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(
            href as string,
          )}" />`,
      )
      .join("\n");

    urlBlocks.push(
      `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${alternateLinks ? `\n${alternateLinks}` : ""}
  </url>`,
    );
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
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
