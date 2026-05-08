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
    signIn: "/admin/login",
    error: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 jours
    updateAge: 24 * 60 * 60, // refresh JWT toutes les 24h
  },
  callbacks: {
    /**
     * Authorize callback — appele par le middleware pour decider si la requete
     * peut continuer ou doit etre redirigee vers /admin/login.
     *
     * @param auth   La session JWT decode (null si pas connecte)
     * @param request La NextRequest
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const adminPrefix = `/${process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"}`;
      const isOnAdmin = nextUrl.pathname.startsWith(adminPrefix);
      const isOnAuthPage =
        nextUrl.pathname === `${adminPrefix}/login` || nextUrl.pathname === `${adminPrefix}/2fa`;

      if (isOnAdmin && !isOnAuthPage) {
        if (!isLoggedIn) return false; // → redirect /admin/login
        return true;
      }
      // User connecte qui visite /login → on le renvoie sur le dashboard
      if (isLoggedIn && isOnAuthPage) {
        return Response.redirect(new URL(adminPrefix, nextUrl));
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
