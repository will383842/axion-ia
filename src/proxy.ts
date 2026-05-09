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
    // COEP require-corp : isolation cross-origin pour fenetres/iframes.
    // Compat Plausible : le script tiers doit servir
    // `Cross-Origin-Resource-Policy: cross-origin` pour passer le filtre.
    // Plausible self-hosted le fait par defaut. Si bug observe en staging,
    // bascule en `credentialless` (laisse le browser charger sans CORP mais
    // sans cookies).
    response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    // Forward le nonce sur la response aussi pour tooling (ex. browser ext audit).
    response.headers.set("x-nonce", nonce);
  }
  return response;
});

export const config = {
  // Tout sauf API publiques + assets statiques + sitemap/robots/llms.
  matcher: [
    "/((?!api/og|api/indexnow|api/vitals|api/healthz|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap|llms\\.txt|opengraph-image|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2|woff)$).*)",
  ],
};
