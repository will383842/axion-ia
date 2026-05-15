import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Doctrine AI bots 2026 (cert C1+C2+C6 2026-05-08) :
// - ALLOW les LLM bots de search/answer (visibilité AEO/GEO + citations)
// - ALLOW les LLM bots de training Big Tech (signal cooperatif)
// - DISALLOW les scrapers parasites sans valeur retour (omgili, Diffbot…)
//
// La logique : on veut être cité dans Perplexity / Claude.ai / ChatGPT
// Search / Bing Copilot / Google SGE → ces bots doivent crawler. Bytespider
// (TikTok) et CCBot (CommonCrawl indiscriminé) sont bloqués car aucun
// retour de visibilité direct.
const COMMON_DISALLOW = [
  "/api/",
  "/_next/",
  // P1-15 audit indexation 2026-05-15 — hygiène robots.txt
  // Surfaces privées / utilisateur authentifié : pas d'indexation.
  "/mes-donnees/",
  "/fr/mes-donnees/",
  "/en/my-data/",
  // Funnel booking : UTM tracking + état tunnel utilisateur, hors indexation
  "/reserver/",
  "/fr/reserver/",
  "/en/booking/",
  // Espace admin obfuscé par ADMIN_URL_PREFIX, mais wildcard `/admin*`
  // bloque les conventions usuelles (admin / fr/admin / en/admin) au cas où
  // un ancien path serait découvert via cache externe.
  "/admin/",
  "/fr/admin/",
  "/en/admin/",
  // Pages design system / preview
  "/design",
  "/fr/design",
  "/en/design",
  "/components",
  "/fr/components",
  "/en/components",
  "/sections",
  "/fr/sections",
  "/en/sections",
];

const AI_BOTS_ALLOWED = [
  "GPTBot", // OpenAI training
  "OAI-SearchBot", // ChatGPT Search
  "ChatGPT-User", // ChatGPT browsing
  "ClaudeBot", // Anthropic training
  "anthropic-ai", // legacy Anthropic
  "Claude-Web", // Claude.ai citations
  "PerplexityBot", // Perplexity
  "Perplexity-User", // Perplexity browsing
  "Google-Extended", // Google AI training (Gemini, SGE)
  "Applebot-Extended", // Apple Intelligence training
  "Mistral-User", // Mistral chat
  "Bingbot", // Bing + Copilot
  "Meta-ExternalAgent", // Meta AI
];

const AI_BOTS_DISALLOWED = [
  "CCBot", // CommonCrawl indiscriminé
  "Bytespider", // TikTok
  "omgili", // scraper parasite
  "Diffbot", // scraper SaaS sans retour
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: COMMON_DISALLOW,
      },
      // P1-16 audit indexation 2026-05-15 — Bingbot Crawl-delay 1 s.
      // Bingbot est historiquement 10× plus agressif que Googlebot. Sur ~13K
      // routes pSEO villes + factory 100/jour, sans throttle, il peut écraser
      // l'origin Coolify (cache MISS prolongé observé prod). Le delay 1s reste
      // safe pour le ranking (Bing tolère jusqu'à 30s).
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: COMMON_DISALLOW,
        crawlDelay: 1,
      },
      ...AI_BOTS_ALLOWED.filter((u) => u !== "Bingbot").map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: COMMON_DISALLOW,
      })),
      ...AI_BOTS_DISALLOWED.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    // /sitemap-index.xml = root sitemap-index listing all sub-sitemaps emitted
    // via `generateSitemaps()` in `app/sitemap.ts`. Next 16 reserves /sitemap.xml
    // for the metadata convention itself (which only generates `/sitemap/<id>.xml`
    // sub-sitemaps, no auto-index), so the index is exposed at /sitemap-index.xml
    // via `app/sitemap-index.xml/route.ts`. Googlebot follows this directive
    // and discovers the ~17 500 SSG routes through the indexed sub-sitemaps.
    sitemap: `${SITE_URL}/sitemap-index.xml`,
    host: SITE_URL,
  };
}
