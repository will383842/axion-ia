// Sitemap-index racine — listing de tous les sub-sitemaps émis via
// `generateSitemaps()` dans `app/sitemap.ts`.
//
// Pourquoi ce fichier existe et pas `app/sitemap.xml/route.ts` :
//   Next 16 réserve le path `/sitemap.xml` à la convention metadata
//   `app/sitemap.ts` (`generateSitemaps()` génère `/sitemap/<id>.xml`).
//   Tenter un Route Handler à `app/sitemap.xml/route.ts` produit un
//   build error « Conflicting route and metadata at /sitemap.xml ».
//   Solution : exposer l'index racine à `/sitemap-index.xml` et
//   référencer ce path dans `robots.ts` (Sitemap directive).
//
//   Sans cet index, Googlebot ne découvre que le sub-sitemap pointé
//   par robots.txt — il ne saurait pas que les autres sub-sitemaps
//   `/sitemap/<id>.xml` existent. Avec cet index, un seul fetch
//   `Sitemap: /sitemap-index.xml` suffit pour découvrir les ~17 500
//   routes SSG (cities, services × cities, blog, case studies, etc.).
//
// Cet endpoint réutilise la même fonction `generateSitemaps()` que
// `app/sitemap.ts`, garantissant que l'index reste synchronisé avec
// les sub-sitemaps réellement émis.
//
// Sub-sitemaps custom (hors `generateSitemaps()`) — référencés manuellement :
//   - `/sitemap-news.xml` : Route Handler XML brut conforme Google News
//     (namespace `xmlns:news`, fenêtre 48h stricte, max 1000 URLs).
//     Ne peut PAS passer par `MetadataRoute.Sitemap` (pas de support
//     `xmlns:news`). Cf. `app/sitemap-news.xml/route.ts` + audit
//     Sitemap+IndexNow 2026-05-15 AGENT 4 §4.1.3 P0-3.

import { generateSitemaps } from "../sitemap";
import { SITE_URL } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

// Sub-sitemaps custom (Route Handlers XML brut, hors `generateSitemaps()`).
// Référencés manuellement pour que Googlebot les découvre via l'index racine.
//
// - `/sitemap-news.xml`        : Google News (namespace `xmlns:news`, fenêtre 48h)
//
// Image Sitemap 1.1 (FR/EN) retiré audit indexation FR 2026-05-15 P0-3 :
// référencés mais Route Handlers inexistants → 404 systématique côté Googlebot.
// Réintroduire QUAND la banque d'images V2 (PROMPT-IMAGE-BANK-MASTER-2026)
// livrera les builders correspondants.
const CUSTOM_SITEMAPS: ReadonlyArray<string> = [
  "/sitemap-news.xml",
  // KB DB-aware (content-gen, audience=public). Déplacé de la convention metadata
  // `generateSitemaps()` (où le compte au build stub.invalid = 0 → 404 fantômes)
  // vers un Route Handler runtime. Cf. `app/sitemap-knowledge.xml/route.ts`.
  "/sitemap-knowledge.xml",
  // Image Sitemap 1.1 — image-bank V1 (réintroduit Sprint 4 V1 2026-05-16,
  // builders `app/sitemaps/images-{fr,en}.xml/route.ts` livrés).
  "/sitemaps/images-fr.xml",
  "/sitemaps/images-en.xml",
  // Image Sitemap — services (73 images marketing) + villes France (2 157 communes).
  // image-bank-complet audit 2026-05-20.
  "/sitemap-images-services.xml",
  "/sitemap-images-villes-t1.xml",
  "/sitemap-images-villes-t2.xml",
  "/sitemap-images-villes-t3-t4.xml",
  // Module recrutement commercial (devenir-commercial-ia) — hubs T1+T2 indexables
  // + France + candidature. Route Handler isolé (ne touche pas sitemap.ts).
  "/sitemap-recrutement.xml",
  // Offres d'emploi (/carrieres) — DB-driven (offres publiées indexables).
  "/sitemap-carrieres.xml",
];

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * Audit indexation 2026-05-15 P1-14 — lastmod différencié par catégorie.
 *
 * Avant ce patch : un seul `new Date().toISOString()` partagé par TOUS les
 * sub-sitemaps → Google ignore le signal `lastmod` (tous identiques = suspect).
 *
 * Maintenant : on lit la `MAX(updatedAt)` réelle par source DB. Fail-soft :
 * si la query échoue (P2021 / DB down), on retombe sur un fallback déterministe.
 *
 * Audit indexation 2026-05-18 P0-2 — le fallback était `new Date()` (worker boot
 * time, uniforme sur 13/15 sub-sitemaps → Google désactive le signal lastmod).
 * Corrigé alors en `BUILD_TIME`.
 *
 * Audit fraîcheur 2026-06-08 — `BUILD_TIME` restait du date-gaming : les sub-
 * sitemaps statiques/pSEO (pages, faq, help, villes, services-villes) se
 * déclaraient « modifiés » à CHAQUE deploy sans changement de contenu. Sur un
 * site jeune à faible crawl-budget, Google re-crawle alors de l'inchangé.
 * Fix : fallback figé sur une date éditoriale STABLE (= `EDITORIAL_BASELINE` de
 * `sitemap.ts`, gardée en sync manuellement). Les sources DB (news/knowledge/blog)
 * conservent leur `MAX(updatedAt)` réel (signal honnête, gold-standard intact).
 * Cf. `_AUDIT/PLAN-FRESHNESS-EXHAUSTIF-2026-06-08.md`.
 */
// ⚠️ Garder en sync avec `EDITORIAL_BASELINE` dans `src/app/sitemap.ts`.
const EDITORIAL_BASELINE_ISO = "2026-06-08T00:00:00.000Z";

function getFallbackLastmod(): string {
  return EDITORIAL_BASELINE_ISO;
}

async function getDifferentiatedLastmod(): Promise<{
  news: string;
  knowledge: string;
  blog: string;
  fallback: string;
}> {
  const fallback = getFallbackLastmod();
  const result = {
    news: fallback,
    knowledge: fallback,
    blog: fallback,
    fallback,
  };
  try {
    const newsMax = await prisma.article.findFirst({
      where: { isNews: true, status: "published" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    if (newsMax?.updatedAt) result.news = newsMax.updatedAt.toISOString();
  } catch {
    // best-effort
  }
  try {
    const blogMax = await prisma.article.findFirst({
      where: { isNews: false, status: "published" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    if (blogMax?.updatedAt) result.blog = blogMax.updatedAt.toISOString();
  } catch {
    // best-effort
  }
  try {
    const kbMax = await prisma.knowledgeEntry.findFirst({
      where: { status: { in: ["published", "deprecated"] }, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    if (kbMax?.updatedAt) result.knowledge = kbMax.updatedAt.toISOString();
  } catch {
    // best-effort
  }
  return result;
}

function lastmodForGeneratedId(
  id: string,
  lastmods: Awaited<ReturnType<typeof getDifferentiatedLastmod>>,
): string {
  if (id === "blog") return lastmods.blog;
  if (id.startsWith("knowledge-")) return lastmods.knowledge;
  // pages / faq / help / cas-concrets / villes-* / interventions / services-villes-*
  // → date éditoriale figée (audit fraîcheur 2026-06-08) : ces routes pSEO/statiques
  // ne changent pas à chaque deploy, donc leur lastmod ne doit pas bouger non plus.
  return lastmods.fallback;
}

export async function GET(): Promise<Response> {
  const sitemaps = await generateSitemaps();
  const lastmods = await getDifferentiatedLastmod();

  const generatedBlocks = sitemaps.map(({ id }) => {
    const lm = lastmodForGeneratedId(id, lastmods);
    return `  <sitemap>
    <loc>${SITE_URL}/sitemap/${id}.xml</loc>
    <lastmod>${lm}</lastmod>
  </sitemap>`;
  });

  const customBlocks = CUSTOM_SITEMAPS.map((path) => {
    // sitemap-news.xml      → max(updatedAt) Article isNews
    // sitemap-knowledge.xml → max(updatedAt) KnowledgeEntry (signal fraîcheur réel)
    const lm =
      path === "/sitemap-news.xml"
        ? lastmods.news
        : path === "/sitemap-knowledge.xml"
          ? lastmods.knowledge
          : lastmods.fallback;
    return `  <sitemap>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lm}</lastmod>
  </sitemap>`;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...generatedBlocks, ...customBlocks].join("\n")}
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Audit indexation 2026-05-18 P1-13 — réduction `s-maxage=86400` (24h)
      // → `s-maxage=600` (10 min). Avant : Cloudflare cachait l'index 24h ce qui
      // masquait les nouvelles URLs jusqu'à 24h après publish. Maintenant : CDN
      // refresh sous 10 min après publish d'un Article tier-1 ou promotion ville.
      // Charge origin négligeable car ISR Next 16 (`revalidate=3600`) sert depuis
      // memory cache du worker.
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
