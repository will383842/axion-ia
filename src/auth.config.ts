// Auth.js v5 — config Edge-safe (Sprint 15 / M8).
//
// Cette config est consommee par le middleware Next.js (Edge runtime).
// Elle ne doit PAS importer Prisma, ioredis, argon2 ou autres modules Node-only.
//
// La config complete avec Credentials provider vit dans `src/auth.ts`
// (importee uniquement par les route handlers + Server Actions, qui tournent
// en Node runtime).

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/fr/admin/login", // remap dynamique gere dans authorized()
    error: "/fr/admin/login",
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
