// Middleware Auth.js v5 (Sprint 15 / M8).
//
// Protege /[ADMIN_URL_PREFIX]/* via authConfig.callbacks.authorized.
// Edge runtime — n'importe rien de Node-only.
//
// Matcher exclut explicitement :
// - assets statiques (_next/static, _next/image, favicon, public/*)
// - API publiques (api/og, api/indexnow, api/vitals)
// - sitemap, robots, llms.txt

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Tout sauf API publiques + assets statiques.
  matcher: [
    "/((?!api/og|api/indexnow|api/vitals|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap|llms\\.txt|opengraph-image|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2|woff)$).*)",
  ],
};
