// Content Security Policy helpers (Sprint 24 / B1 + B2).
//
// Stratégie :
//  - Le proxy.ts génère un nonce par requête et le pose en `x-nonce` sur la
//    requête + en `script-src 'nonce-…'` sur la response. La CSP retournée
//    dépend du chemin :
//      * `/<ADMIN_URL_PREFIX>/*` (admin déjà force-dynamic)  → CSP STRICT
//        (`nonce` + `strict-dynamic`, sans `unsafe-inline`, sans `unsafe-eval`).
//      * Tout le reste (SSG public massif, ~17500 routes)    → CSP SOFT
//        (compat avec les inline scripts JSON-LD + speculation rules pré-rendus
//        au build, donc nonce-less). La migration vers strict-dynamic sur tout
//        le site nécessite soit (a) le passage de `app/[locale]/layout.tsx`
//        en force-dynamic — gros impact LCP/cache HCU, soit (b) une CSP
//        hash-based pour les inline scripts. Décision parquée Sprint 16 PERF.
//  - Le helper `cspNonce()` lit `x-nonce` côté Server Component / Server Action
//    via `headers()`. Toute route qui l'invoque devient dynamique
//    automatiquement (Next.js opt-in via headers()).

import { headers } from "next/headers";

const STATIC_ASSETS_RE = /\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2?|js|css|map)$/;

/**
 * Génère un nonce cryptographique 24 bytes encodé base64 (Edge-compatible —
 * pas de Node `crypto`). Format compatible CSP3 nonce-source.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Lit le nonce CSP de la requête courante. Renvoie `null` si la fonction est
 * appelée hors contexte requête (build SSG, vitest, edge cases). Toute route
 * qui appelle ce helper devient dynamique (cf. `headers()` Next.js docs).
 */
export async function cspNonce(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-nonce");
  } catch {
    return null;
  }
}

export interface BuildCspOptions {
  nonce: string;
  /** Mode strict (admin) → pas de `unsafe-inline` / `unsafe-eval`. */
  strict: boolean;
  /**
   * Route d'embed (widget offres d'emploi) → `frame-ancestors *` au lieu de
   * `'none'` pour autoriser l'iframe depuis n'importe quel domaine tiers.
   */
  embed?: boolean;
}

/**
 * Construit la chaîne CSP. En mode strict, l'inline-without-nonce est bloqué.
 * En mode soft, l'inline reste autorisé (SSG public preserved).
 *
 * Mode strict (admin) : nonce + strict-dynamic, pas d'unsafe-inline / unsafe-eval.
 *
 * Mode soft (SSG public) : `unsafe-inline` + `unsafe-eval` SEULS, **sans nonce
 * ni strict-dynamic**. Cause : selon CSP3 (et tous les browsers modernes),
 * dès qu'un `nonce-*` ou hash apparaît dans script-src, `unsafe-inline` est
 * IGNORÉ. Idem pour `strict-dynamic` qui désactive les host allowlists ET
 * bypass `unsafe-inline`. Combiner les deux régimes dans la même directive
 * = tout l'inline non-noncé est bloqué → hydration Next.js cassée → pages
 * "vides" en prod (bug observé 2026-05-09 sur axion-ia.com).
 *
 * Tradeoff assumé : la SSG publique reste sur CSP relaxed (acceptable pour
 * un site marketing public sans auth ; ADR pas de PII saisi sur ces routes).
 * L'admin garde la CSP nonce+strict-dynamic, qui est le vrai périmètre
 * sensible. Migration globale vers strict-dynamic = Sprint 16 PERF (cf.
 * commentaire en tête de fichier).
 */
export function buildCspHeader({ nonce, strict, embed = false }: BuildCspOptions): string {
  // Microsoft Clarity (NEXT_PUBLIC_CLARITY_PROJECT_ID + consent CMP gated).
  // Domaines : www.clarity.ms (tag loader) + *.clarity.ms (collecteurs régionaux,
  // c.clarity.ms ingest, b.clarity.ms beacon). Sans whitelist explicite, le script
  // est bloqué CSP même en mode soft. Le composant `Clarity` (use client) ne
  // déclenche un fetch que post-consent visiteur (`CookieConsent` banner).
  // Next 16 émet automatiquement un `<script type="speculationrules">` inline
  // dans le <head> pour pré-fetcher les routes hover (perf LCP/INP). Avec CSP
  // strict + strict-dynamic, ce script INLINE est bloqué car il n'a pas le
  // nonce attribut (Next ne l'injecte PAS sur les Speculation Rules scripts —
  // bug Next 16 #XXX). Sans fix, l'admin affiche en console :
  //
  //   Applying inline speculation rules violates ... script-src 'self' 'nonce-...'
  //   'strict-dynamic'... Either 'unsafe-inline', a hash ('sha256-vy7BO95...'),
  //   or a nonce is required.
  //
  // Le hash sha256 fourni est STABLE par version Next.js (le contenu JSON
  // speculation rules est identique pour toutes les pages : config globale
  // prefetch on-hover). On l'autorise explicitement avec 'unsafe-hashes' +
  // hash → conserve la sécurité strict-dynamic SANS bloquer Next 16.
  //
  // Si une future version Next change le contenu speculation rules, ce hash
  // doit être mis à jour. À monitorer en CI via test e2e qui vérifie
  // /admin /login affiche 0 erreur CSP en console.
  const SPECULATION_RULES_HASH = "'sha256-vy7BO95SqCwcPVAwxQTU/zWpSiYL9C1CWCCb1LB+ni4='";
  // Calendly inline widget (`/appel` Sprint A correctif 2026-05-25) charge
  // `assets.calendly.com/assets/external/widget.js` via next/script lazyOnload.
  // Connect + frame ajoutés plus bas pour l'iframe `calendly.com/{user}/{event}`.
  const scriptSrc = strict
    ? [
        "script-src",
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        SPECULATION_RULES_HASH,
        "https://challenges.cloudflare.com",
        "https://plausible.axion-ia.com",
        "https://www.clarity.ms",
        "https://*.clarity.ms",
      ].join(" ")
    : [
        "script-src",
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://challenges.cloudflare.com",
        "https://plausible.axion-ia.com",
        "https://www.clarity.ms",
        "https://*.clarity.ms",
        "https://assets.calendly.com",
      ].join(" ");

  // 🔴 ORIGINES STRIPE — CONDITIONNÉES À L'ACTIVATION (2026-08-04).
  //
  // Elles étaient autorisées en dur « pour Stripe.js (publishable key client) »
  // et « si on bascule un jour à Stripe Elements ». Or Stripe est éteint :
  // `STRIPE_ENABLED` n'est pas posé en production, `isStripeConfigured()`
  // renvoie false, et **aucun code client ne charge Stripe.js** — pas une seule
  // occurrence de `@stripe/stripe-js` ou `loadStripe` dans le dépôt. La clé
  // publiable n'est même pas définie en prod.
  //
  // Une CSP qui autorise des origines inutilisées élargit la surface sans
  // contrepartie : c'est la définition d'une permission à retirer. On les gate
  // sur le même drapeau que le reste, pour qu'elles se rétablissent d'elles-mêmes
  // le jour où le paiement en ligne est réactivé — plutôt que de les retirer et
  // de laisser un iframe blanc à qui rallumera Stripe sans penser à la CSP.
  const stripeActif = process.env["STRIPE_ENABLED"] === "true";
  const stripeConnect = stripeActif ? " https://api.stripe.com" : "";
  const stripeFrame = stripeActif ? " https://checkout.stripe.com" : "";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' https://challenges.cloudflare.com https://plausible.axion-ia.com https://api.telegram.org https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io${stripeConnect} https://www.clarity.ms https://*.clarity.ms https://calendly.com https://*.calendly.com https://*.r2.cloudflarestorage.com`,
    // `*.r2.cloudflarestorage.com` : upload présigné direct navigateur→R2
    // (import de kit + uploads admin documents-interventions). Sans ça, la CSP
    // bloque le PUT du fichier vers le stockage (fix 2026-06-13).
    // `plausible.axion-ia.com` autorisé pour l'embed dashboard dans
    // /fr/{prefix}/analytics (Plausible "Shared link" iframe).
    // `calendly.com` + `*.calendly.com` autorisés pour l'embed booking inline
    // sur /appel — le widget Calendly charge des iframes enfants sur des
    // sous-domaines (event.calendly.com, calendar.calendly.com) qui doivent
    // être whitelistés sinon l'iframe reste blanche (fix 2026-05-27).
    `frame-src 'self' https://challenges.cloudflare.com${stripeFrame} https://plausible.axion-ia.com https://calendly.com https://*.calendly.com`,
    // Route d'embed widget → framable partout. Sinon `'none'` (anti-clickjacking).
    embed ? "frame-ancestors *" : "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Détermine si un pathname doit recevoir la CSP strict (admin) ou soft.
 * Edge-runtime safe — pas d'accès DB, lecture env-only.
 */
export function isStrictCspPath(pathname: string): boolean {
  if (STATIC_ASSETS_RE.test(pathname)) return false;
  const adminSegment = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";
  // Match `/<locale>/<adminSegment>` (ex: /fr/admin-dev-x7k2n9/...)
  // et `/<adminSegment>` (sans locale → redirect probable, durcir quand même).
  return pathname.includes(`/${adminSegment}`);
}

// Route d'embed du widget offres d'emploi : `/<locale>/carrieres/widget`
// (avec ou sans slash final). EXCLUT `/carrieres/widget-builder` (le suffixe
// `-builder` empêche le match car suivi ni de `/` ni de fin de chaîne).
const EMBED_PATH_RE = /^\/(?:fr|en)\/carrieres\/widget(?:\/|$)/;

/**
 * `true` si le chemin est la route d'embed framable (CSP `frame-ancestors *`,
 * pas de `X-Frame-Options`). Edge-runtime safe (regex pure).
 */
export function isEmbedPath(pathname: string): boolean {
  return EMBED_PATH_RE.test(pathname);
}

// Pages qui EMBARQUENT une iframe tierce nécessitant ses cookies/session :
// `/<locale>/appel` (+ `/book-a-call` EN, redirigé vers FR mais inclus par
// sûreté) chargent le widget Calendly. `Cross-Origin-Embedder-Policy:
// credentialless` charge les iframes cross-origin SANS credentials → Calendly
// ne peut pas établir sa session → « calendly.com refused to connect ». Ces
// chemins reçoivent donc `COEP: unsafe-none`. Audit 2026-07-01.
const CREDENTIALED_EMBEDDER_PATH_RE = /^\/(?:fr|en)\/(?:appel|book-a-call)(?:\/|$)/;

/**
 * `true` si la page embarque une iframe tierce credentialée (Calendly sur
 * `/appel`) et doit donc RELÂCHER `Cross-Origin-Embedder-Policy` (unsafe-none)
 * au lieu de `credentialless`. Edge-runtime safe (regex pure).
 */
export function isCredentialedEmbedderPath(pathname: string): boolean {
  return CREDENTIALED_EMBEDDER_PATH_RE.test(pathname);
}
