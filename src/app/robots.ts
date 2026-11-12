import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Doctrine AI bots — décision de Williams du 09/11/2026 : « être cité par les IA »
// (option A « cité partout »). Remplace la doctrine du 22/06/2026 « bloquer le
// training, garder la citation ».
// - AUCUN robot d'IA n'est nommé : GPTBot, ClaudeBot, anthropic-ai, Google-Extended,
//   CCBot, Applebot-Extended, OAI-SearchBot, Claude-SearchBot, PerplexityBot, etc.
//   héritent tous du groupe `User-agent: *`. Pour un organisme de formation encore
//   peu connu, être dans les données d'entraînement est un gain, pas une perte.
// - Seuls les scrapers parasites sans valeur retour (Bytespider, omgili, Diffbot)
//   restent en `Disallow: /`.
// - Pas de groupe Bingbot ni de `crawl-delay`, pas de directive `Host:` (lue
//   seulement par Yandex).
const COMMON_DISALLOW = [
  "/api/",
  "/_next/",
  // GEO-035 (audit GEO/AEO 2026-08-14) — les routes de telechargement de la
  // banque d'images. Chaque visite y declenche une transformation Sharp et une
  // ecriture en base ; les pages galerie en exposent DEUX ancres chacune, soit
  // ~576 URLs crawlables pour ~288 pages. Aucune n'a de valeur d'indexation :
  // ce sont des actions, pas des documents.
  //
  // Les deux locales sont listees : le segment est traduit (`telecharger` en
  // FR, `download` en EN) et robots.txt ne connait pas la table de routage.
  // L'etoile initiale couvre le prefixe de locale.
  "/*/telecharger",
  "/*/download",
  // P1-15 audit indexation 2026-05-15 — hygiène robots.txt
  // Surfaces privées / utilisateur authentifié : pas d'indexation.
  "/mes-donnees/",
  "/fr/mes-donnees/",
  "/en/my-data/",
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
// `/api/avis/photo/` : photos publiques optimisées des avis clients. `Disallow:
// /api/` bloquerait Googlebot-Image de les crawler → même correctif que `/api/og`
// (longest-match `Allow` débloque). Indispensable pour l'indexation Google Images.
// AUDIT 2026-07-21 — `/_next/static` AJOUTÉ.
// `Disallow: /_next/` bloquait aussi `/_next/static/**`, c'est-à-dire le **CSS et
// le JS** de toutes les pages. Google demande explicitement de ne pas bloquer ces
// ressources : Googlebot rend la page pour l'évaluer, et sans feuille de style ni
// script il la voit cassée (mise en page, contenu injecté, Core Web Vitals).
// C'est un risque bien plus documenté et bien plus concret que la question
// de l'entraînement des IA. Longest-match : cet `Allow`
// l'emporte sur le `Disallow: /_next/`, sans rouvrir `/_next/data` ni le reste.
// AUDIT GEO/AEO — `/api/markdown/` AJOUTÉ (verrou n°2 de l'audit du 2026-07-20,
// resté ouvert).
//
// `/llms.txt` ANNONCE le canal d'ingestion
// `https://axion-ia.com/api/markdown/actualites/{slug}` aux moteurs IA, et la
// route existe et fonctionne (`api/markdown/[type]/[slug]/route.ts` → 200
// `text/markdown`, ~10 ko de contenu réel, 5 types : blog, actualites, guides,
// cas-concrets, centre-aide, faq, kb).
//
// Or `Disallow: /api/` figure dans les DOUZE blocs user-agent et rien
// n'autorisait `/api/markdown/`. On publiait donc une invitation à ingérer un
// contenu qu'aucun crawler respectueux n'avait le droit de lire — les deux
// fichiers se contredisaient, et c'est le silencieux qui gagnait.
//
// Tous les robots (IA comprises) héritent du groupe `*` : cet Allow vaut pour eux.
//
// Longest-match : cet `Allow` l'emporte sur `Disallow: /api/`, exactement comme
// `/api/og` et `/api/avis/photo` ci-dessus, sans rouvrir `/api/auth`,
// `/api/admin`, les webhooks ni les routes RGPD.
//
// AUDIT GEO/AEO 2026-08-15 (GEO-031) — exports Observatoire AJOUTÉS.
// Même classe d'erreur que `/api/markdown/` ci-dessus, sur une autre surface :
// `/llms.txt` annonce l'Observatoire en « données ouvertes CC BY 4.0 » et la
// page `/observatoire-ia` déclare ses deux exports en JSON-LD `DataDownload`.
// Or `Disallow: /api/` les interdisait dans les douze blocs — on publiait une
// licence d'usage sur un fichier qu'aucun crawler respectueux n'avait le droit
// de télécharger. Un jeu de données ouvert non téléchargeable n'est pas cité.
//
// 🔴 Forme ÉTROITE délibérée (deux entrées explicites) plutôt que le préfixe
// `/api/observatoire/`. `src/app/api/observatoire/` ne contient AUJOURD'HUI que
// ces deux routes, toutes deux publiques — mais le préfixe autoriserait par
// avance toute route future ajoutée sous ce dossier, y compris une route
// d'écriture ou d'administration. On n'ouvre que ce qu'on a vérifié.
const COMMON_ALLOW = [
  "/",
  "/api/og",
  "/api/avis/photo",
  "/api/markdown/",
  "/api/observatoire/export-csv",
  "/api/observatoire/export-json",
  "/_next/image",
  "/_next/static",
];

// Scrapers parasites sans valeur retour : seuls robots bloqués.
const BOTS_BLOQUES = [
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
      {
        userAgent: BOTS_BLOQUES,
        disallow: "/",
      },
    ],
    // /sitemap-index.xml = root sitemap-index listing all sub-sitemaps emitted
    // via `generateSitemaps()` in `app/sitemap.ts`. Next 16 reserves /sitemap.xml
    // for the metadata convention itself (which only generates `/sitemap/<id>.xml`
    // sub-sitemaps, no auto-index), so the index is exposed at /sitemap-index.xml
    // via `app/sitemap-index.xml/route.ts`. Googlebot follows this directive
    // and discovers the ~17 500 SSG routes through the indexed sub-sitemaps.
    sitemap: `${SITE_URL}/sitemap-index.xml`,
  };
}
