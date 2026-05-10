// Auth.js v5 — config Edge-safe (Sprint 15 / M8).
//
// Cette config est consommee par le middleware Next.js (Edge runtime).
// Elle ne doit PAS importer Prisma, ioredis, argon2 ou autres modules Node-only.
//
// La config complete avec Credentials provider vit dans `src/auth.ts`
// (importee uniquement par les route handlers + Server Actions, qui tournent
// en Node runtime).

import type { NextAuthConfig } from "next-auth";

// Lit ADMIN_URL_PREFIX depuis l'env au moment du module load (Edge runtime
// = même process pour toutes les requêtes). Auth.js v5 exige une string
// statique pour `pages.signIn` (pas une fonction), donc on la résout ici.
// Si l'env var change en cours de runtime (rare), un redéploiement est
// nécessaire — comportement attendu pour une URL de fingerprint admin.
const adminUrlPrefix = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";

export const authConfig = {
  pages: {
    // Construit dynamiquement depuis ADMIN_URL_PREFIX au lieu de hardcoder
    // /fr/admin/login (qui pointait sur une route inexistante en prod où
    // le prefix vaut admin-xfz5hk0j7hrk). Bug latent : si Auth.js
    // redirigeait vers cette page (catch-all redirect avant authorized()),
    // l'utilisateur voyait un 404. Le callback authorized() ci-dessous
    // override la plupart des cas mais pas tous (server actions errors,
    // etc.).
    signIn: `/fr/${adminUrlPrefix}/login`,
    error: `/fr/${adminUrlPrefix}/login`,
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 jours
    updateAge: 24 * 60 * 60, // refresh JWT toutes les 24h
  },
  callbacks: {
    /**
     * Authorize callback — invoque par le middleware sur chaque request matchee.
     * Doctrine CLAUDE.md §14 : interface admin FR uniquement, mais on tolere
     * /en/<prefix>/* en redirigeant vers /fr/<prefix>/* (layout admin gere
     * la redirection finale).
     *
     * URL pattern : /{fr|en}/{ADMIN_URL_PREFIX}/...
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const adminSegment = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";
      const adminRegex = new RegExp(`^/(fr|en)/${adminSegment}(?:/|$)`);
      const isOnAdmin = adminRegex.test(nextUrl.pathname);
      if (!isOnAdmin) return true; // hors admin = laisse passer (public site)

      const loginRegex = new RegExp(`^/(fr|en)/${adminSegment}/login/?$`);
      const isOnAuthPage = loginRegex.test(nextUrl.pathname);

      // Page login accessible meme deconnecte
      if (isOnAuthPage) {
        if (isLoggedIn) {
          // User deja connecte → renvoie vers le dashboard FR
          return Response.redirect(new URL(`/fr/${adminSegment}`, nextUrl));
        }
        return true;
      }

      // Toute autre page admin (incluant /2fa/setup, /, sub-routes) exige login
      if (!isLoggedIn) {
        return Response.redirect(new URL(`/fr/${adminSegment}/login`, nextUrl));
      }
      return true;
    },
    /**
     * JWT callback — invoque a chaque cycle (signIn, session refresh, update).
     * On enrichit le token avec les claims metier au signIn.
     */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    /**
     * Session callback — projection du JWT vers la session UI.
     */
    session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // injecte dans src/auth.ts (Node runtime uniquement)
} satisfies NextAuthConfig;
