// Next.js 16 proxy.ts — fusion i18n (next-intl) + auth (Auth.js v5).
//
// Next 16 a renomme `middleware.ts` → `proxy.ts` et n'autorise plus qu'un seul
// fichier. On enchaine donc :
//   1. Auth.js wrapper (verifie session JWT, redirige vers /admin/login si KO)
//   2. next-intl handler (resolution locale fr|en, rewrites, redirects)
//
// Auth.js applique d'abord callbacks.authorized (dans `auth.config.ts`), qui
// laisse passer les routes publiques et redirige uniquement les /admin/*.
// Ensuite handleI18nRouting traite la locale.
//
// Edge runtime — aucun import Node-only autorise (pas de Prisma, ioredis, etc).

import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { authConfig } from "./auth.config";
import { routing } from "./i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  return handleI18nRouting(req as unknown as NextRequest);
});

export const config = {
  // Tout sauf API publiques + assets statiques + sitemap/robots/llms.
  matcher: [
    "/((?!api/og|api/indexnow|api/vitals|api/healthz|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap|llms\\.txt|opengraph-image|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2|woff)$).*)",
  ],
};
