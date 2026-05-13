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
export function buildCspHeader({ nonce, strict }: BuildCspOptions): string {
  const scriptSrc = strict
    ? [
        "script-src",
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        "https://challenges.cloudflare.com",
        "https://plausible.axion-ia.com",
      ].join(" ")
    : [
        "script-src",
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://challenges.cloudflare.com",
        "https://plausible.axion-ia.com",
      ].join(" ");

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Sprint X.2 — `https://api.stripe.com` requis pour Stripe.js (publishable
    // key client) + côté serveur indirect via Checkout redirect. `https://checkout.stripe.com`
    // frame-src pour 3DS challenges si on bascule un jour à Stripe Elements (V1.5+).
    "connect-src 'self' https://challenges.cloudflare.com https://plausible.axion-ia.com https://api.telegram.org https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io https://api.stripe.com",
    // `plausible.axion-ia.com` autorisé pour l'embed dashboard dans
    // /fr/{prefix}/analytics (Plausible "Shared link" iframe).
    "frame-src 'self' https://challenges.cloudflare.com https://checkout.stripe.com https://plausible.axion-ia.com",
    "frame-ancestors 'none'",
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
