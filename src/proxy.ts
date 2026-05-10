// Next.js 16 proxy.ts — fusion i18n (next-intl) + auth (Auth.js v5) + CSP nonce.
//
// Next 16 a renomme `middleware.ts` → `proxy.ts` et n'autorise plus qu'un seul
// fichier. On enchaine donc :
//   1. Auth.js wrapper (verifie session JWT, redirige vers /admin/login si KO)
//   2. next-intl handler (resolution locale fr|en, rewrites, redirects)
//   3. CSP nonce + COEP (Sprint 24 / B1 + B2)
//
// Auth.js applique d'abord callbacks.authorized (dans `auth.config.ts`), qui
// laisse passer les routes publiques et redirige uniquement les /admin/*.
// Ensuite handleI18nRouting traite la locale, puis on pose les headers
// securite (CSP avec nonce, COEP).
//
// Edge runtime — aucun import Node-only autorise (pas de Prisma, ioredis, etc).

import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { authConfig } from "./auth.config";
import { routing } from "./i18n/routing";
import { buildCspHeader, generateNonce, isStrictCspPath } from "./lib/csp";

const handleI18nRouting = createIntlMiddleware(routing);
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // 1. Génère un nonce et l'expose à la requête via `x-nonce` AVANT que
  //    next-intl process la requête, pour que les Server Components qui
  //    appellent `cspNonce()` voient le bon header.
  const nonce = generateNonce();
  // Mutation in-place du Headers — Edge runtime garantit la propagation du
  // header request vers les RSC quand intl rewrite/next sans transformer
  // les headers explicitement.
  req.headers.set("x-nonce", nonce);

  // 2. Run intl (locale resolution + rewrites)
  const response = handleI18nRouting(req as unknown as NextRequest);

  // 3. Securite headers (CSP per-path + COEP toujours).
  if (response) {
    const strict = isStrictCspPath(req.nextUrl.pathname);
    response.headers.set("Content-Security-Policy", buildCspHeader({ nonce, strict }));
    // COEP credentialless : isolation cross-origin sans exiger CORP sur chaque
    // ressource externe. Ressources cross-origin chargees sans cookies/creds.
    // Bascule depuis `require-corp` 2026-05-09 — ce dernier bloquait Plausible,
    // Turnstile, fonts Google et assets CDN qui n'envoient pas explicitement
    // Cross-Origin-Resource-Policy. Consequence observee prod : hydration JS
    // partielle → composants Motion restent figes a opacity:0 → site "vide".
    // `credentialless` garde l'isolation (SharedArrayBuffer, COOP cross-origin)
    // sans casser le chargement des assets externes.
    response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
    // Forward le nonce sur la response aussi pour tooling (ex. browser ext audit).
    response.headers.set("x-nonce", nonce);
  }
  return response;
});

export const config = {
  // Tout sauf API publiques + assets statiques + sitemap/robots/llms/manifest/icons.
  // Without `manifest\.webmanifest` exclusion, the i18n middleware rewrites
  // /manifest.webmanifest to /fr/manifest.webmanifest which does not exist
  // (Next.js manifest is root-level via app/manifest.ts), producing a HTML 404
  // that the browser fails to parse as JSON ("Manifest: Syntax error" in
  // DevTools). Same fix already applied for sitemap/robots/llms.
  // `icon` and `apple-icon` are similarly root-only generated routes.
  matcher: [
    // Excludes Auth.js routes (`api/auth/*`) — Auth.js v5 requires its
    // endpoints to live at root /api/auth/* without locale prefix. Without
    // this exclusion, the i18n middleware 307-redirects every Auth.js call
    // (csrf, session, signin, callback/credentials) to /fr/api/auth/*,
    // which Auth.js does not recognize → CredentialsSignin throw on every
    // login attempt → user sees "Code 2FA invalide ou compte verrouille"
    // (the generic catch-block fallback in actions.ts).
    // Discovered live during M9 admin first sign-in 2026-05-10 by
    // observing 307 → location: https://axion-ia.com/fr/api/auth/callback/credentials.
    "/((?!api/og|api/indexnow|api/vitals|api/healthz|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap|llms\\.txt|opengraph-image|manifest\\.webmanifest|^icon$|^apple-icon$|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2|woff)$).*)",
  ],
};
