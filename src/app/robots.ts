import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Doctrine AI bots 2026 (révisée Will 2026-06-22 — « bloquer training / garder citation ») :
// - ALLOW les LLM bots de SEARCH/CITATION (visibilité AEO/GEO + citations directes)
// - DISALLOW les LLM bots de TRAINING (le contenu éditorial n'a pas à entraîner
//   gratuitement les modèles ; les bots de citation sont DISTINCTS des bots de
//   training, donc bloquer le training ne coûte AUCUNE citation)
// - DISALLOW les scrapers parasites sans valeur retour (omgili, Diffbot…)
//
// Pourquoi sans perte de citation : OAI-SearchBot (≠ GPTBot), Claude-Web/
// Claude-SearchBot (≠ ClaudeBot), PerplexityBot, Bingbot crawlent pour CITER.
// Les AI Overviews Google citent via l'index Search (Googlebot), PAS via
// Google-Extended → bloquer Google-Extended ne retire pas des AI Overviews.
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
  // Brand-fix 2026-06-20 — logos CLIENTS (Jardiland, Gedimat, Safti…) servis
  // sous /logos/clients/*.svg. Affichés via le bandeau preuve-sociale
  // (ClientLogosBand) haut de page, Google Images les indexait comme image
  // représentative des pages (ex: jardiland.svg sur /fr/implantations/guadeloupe)
  // → SERP off-brand (marques tierces multicolores au lieu du logo Axion-IA).
  // Disallow longest-match > Allow `/` : empêche Googlebot-Image de les fetcher.
  // Les logos restent visibles pour les visiteurs (le navigateur ignore robots.txt).
  "/logos/clients/",
];

// Audit GSC 2026-05-18 — "Bloquée par robots.txt" sur `/api/og?title=...`.
//
// Les OG images dynamiques (`/api/og/route.tsx`, edge runtime) sont émises par
// les pages qui n'ont pas d'OG image fixe. Sans Allow explicite, le wildcard
// `Disallow: /api/` bloquait Googlebot-Image de fetch ces images → dégrade
// Google Discover, Google Images, et les rich previews SERP qui dépendent
// d'une image fetchable. Allow plus spécifique (longest-match) emporte sur
// Disallow ; les autres routes /api/* (auth, admin, GDPR, webhooks) restent
// disallowed correctement.
//
// `/opengraph-image` (root, file convention Next 16) n'est pas concerné — il
// est déjà sous `Allow: /` par défaut (pas dans COMMON_DISALLOW).
//
// Audit images 2026-06-20 — CAUSE RACINE « 0 image dans Google Images ».
// Les pages galerie + grilles rendent leurs visuels via `next/image` →
// `<img src="/_next/image?url=%2Fimages%2F...webp&w=...&q=...">`. Or le wildcard
// `Disallow: /_next/` ci-dessus empêchait Googlebot-Image de fetcher l'image
// TELLE QU'AFFICHÉE sur la page (Google Images indexe en priorité l'`<img>` du
// DOM hôte, pas seulement le `<image:loc>` du sitemap). Même mécanisme que
// `/api/og` ci-dessus : `Allow: /_next/image` (longest-match) débloque
// l'optimiseur sans rouvrir le reste de `/_next/` (chunks JS, data, etc.).
// SOS-Expat (jumeau indexé dans Google Images) sert ses images en fichiers
// statiques directs, sans optimiseur ni chemin disallowed — d'où l'écart.
const COMMON_ALLOW = ["/", "/api/og", "/_next/image"];

const AI_BOTS_ALLOWED = [
  // SEARCH / CITATION uniquement (ces UA citent, ils n'entraînent pas) :
  "OAI-SearchBot", // ChatGPT Search (≠ GPTBot training)
  "ChatGPT-User", // ChatGPT browsing (action utilisateur)
  "Claude-Web", // Claude.ai citations
  "Claude-SearchBot", // Anthropic search/citation (UA distinct du ClaudeBot training)
  "PerplexityBot", // Perplexity
  "Perplexity-User", // Perplexity browsing
  "Mistral-User", // Mistral chat
  "Bingbot", // Bing + Copilot
  "Meta-ExternalAgent", // Meta AI
  // City Domination 2026-05-18 P1-3 (audit A6 P1-B) — visibilité YandexGPT +
  // Yandex Neuro Europe Est. Yandex couvre ~50 M users russophones (Russie,
  // Biélorussie, Kazakhstan, francophone Europe Est). Couverture wildcard `*`
  // y donnait déjà accès, mais déclaration explicite cohérente avec doctrine
  // « ALLOW search + answer engines ».
  "YandexBot",
  // Audit GEO/AEO 2026-05-20 — déclaration explicite Googlebot-Image pour indexation
  // des images marketing (visibilité Google Images). Déjà couvert par la règle `*`
  // mais explicite pour cohérence avec la doctrine AI bots.
  "Googlebot-Image",
];

// Bots de TRAINING LLM — bloqués (doctrine 2026-06-22 : protéger le contenu
// éditorial de l'entraînement gratuit, sans perdre les citations qui passent
// par les UA de search ci-dessus).
const AI_BOTS_TRAINING_DISALLOWED = [
  "GPTBot", // OpenAI training
  "ClaudeBot", // Anthropic training
  "anthropic-ai", // legacy Anthropic training
  "Google-Extended", // Google AI training (Gemini) — ≠ Googlebot (Search/AI Overviews)
  "Applebot-Extended", // Apple Intelligence training — ≠ Applebot (Search)
];

const AI_BOTS_DISALLOWED = [
  "CCBot", // CommonCrawl indiscriminé
  "Bytespider", // TikTok
  "omgili", // scraper parasite
  "Diffbot", // scraper SaaS sans retour
];

export default function robots(): MetadataRoute.Robots {
  // EN locale désactivé : neutralisation par 301 1-hop UNIQUEMENT (proxy.ts → mapEnToFr).
  // Audit GSC 2026-06-05 A-03 (Invariant #1) — on NE bloque PLUS /en/* en robots :
  // un `Disallow: /en/` empêchait Googlebot de crawler le 301→FR, donc les anciennes
  // URLs EN restaient en index « bloquées robots » au lieu d'être proprement purgées
  // et consolidées vers FR. Laisser crawler le 301 = mécanisme unique et propre.
  // Les surfaces privées EN spécifiques (/en/my-data, /en/booking, /en/admin, /en/design…)
  // restent listées dans COMMON_DISALLOW (privées dans TOUTES les locales).
  // Réversibilité : si EN_LOCALE_ENABLED=true (EN réactivé), /en/* doit rester crawlable
  // pour être indexé → toujours aucun blocage robots. Rien à toggler ici.
  const dynamicDisallow = COMMON_DISALLOW;
  return {
    rules: [
      {
        userAgent: "*",
        allow: COMMON_ALLOW,
        disallow: dynamicDisallow,
      },
      // P1-16 audit indexation 2026-05-15 — Bingbot Crawl-delay 1 s.
      // Bingbot est historiquement 10× plus agressif que Googlebot. Sur ~13K
      // routes pSEO villes + factory 100/jour, sans throttle, il peut écraser
      // l'origin Coolify (cache MISS prolongé observé prod). Le delay 1s reste
      // safe pour le ranking (Bing tolère jusqu'à 30s).
      {
        userAgent: "Bingbot",
        allow: COMMON_ALLOW,
        disallow: dynamicDisallow,
        crawlDelay: 1,
      },
      ...AI_BOTS_ALLOWED.filter((u) => u !== "Bingbot").map((userAgent) => ({
        userAgent,
        allow: COMMON_ALLOW,
        disallow: dynamicDisallow,
      })),
      ...[...AI_BOTS_TRAINING_DISALLOWED, ...AI_BOTS_DISALLOWED].map((userAgent) => ({
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
