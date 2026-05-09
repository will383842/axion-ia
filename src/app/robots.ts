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
      ...AI_BOTS_ALLOWED.map((userAgent) => ({
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
