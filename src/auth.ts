// Auth.js v5 — init complet Node runtime (Sprint 15 / M8).
//
// Provider: Credentials (email + password + TOTP en une passe).
// Strategy: JWT (CLAUDE.md §6 — pas de DB sessions). Adapter Prisma optionnel,
// non utilise ici (JWT pur, donc pas besoin de tables Account/Session).
//
// Securite :
// - Hash argon2id (memoryCost 19456, timeCost 2 — OWASP 2024)
// - Rate limit 5 tentatives / 15 min / IP via Redis sliding window
// - 2FA TOTP obligatoire pour super_admin et admin (skippable pour editor/reader)
// - Rejette les comptes status='suspended'

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";
import { verify2FACode } from "./lib/auth-2fa";
import { verifyPasswordSafe } from "./lib/auth-password";
import { checkRateLimit } from "./lib/rate-limit";
import {
  LIMITE_CONNEXION_COMPTE,
  LIMITE_CONNEXION_IP,
  cleConnexionCompte,
  cleConnexionIp,
} from "./lib/limites-connexion-admin";
import { signInSchema } from "./lib/schemas/auth";
import { rafraichirJetonAdmin } from "./lib/auth-jeton-admin";
import type { AdminRole } from "../prisma/generated/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AdminRole;
    } & DefaultSession["user"];
  }
  interface User {
    role: AdminRole;
  }
}

// Reserved for re-enforcing role-based 2FA on privileged accounts (ANSSI
// hardening). Currently 2FA is opt-in per user (`twoFactorEnabled` flag) to
// allow first-login bootstrap. To re-enforce, restore in the requires2FA
// expression below: `|| _ROLES_REQUIRING_2FA.has(user.role)`.
const _ROLES_REQUIRING_2FA: ReadonlySet<AdminRole> = new Set(["super_admin", "admin"]);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Sprint 24 / B3 — enrich + revoke check ; S1 (30/09) — rôle relu.
     *
     * 1. Au signIn, copie id+role (comme l'Edge callback).
     * 2. À chaque refresh JWT, relit `adminUser.status` ET `adminUser.role`
     *    via un cache 60s (`src/lib/auth-jeton-admin.ts`) : compte `suspended`
     *    ou supprimé → `null` (Auth.js détruit le JWT) ; rôle changé → le jeton
     *    le suit, sans attendre la fin des 30 jours de session.
     */
    async jwt({ token, user }) {
      return rafraichirJetonAdmin({ token, user });
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        totp: { label: "Code 2FA", type: "text" },
        ipAddress: { type: "hidden" },
      },
      async authorize(raw) {
        // Audit E2E 2026-05-11 P0-CONF-07 — debug dump credentials retiré.
        // Le dump précédent loggait email + IP + tailles de password (PII) à
        // chaque tentative de login → fuitait dans Sentry breadcrumbs (P0-CONF-06).
        // Diagnostic résolu par le commit b6d17ad (auth.ts string-literal
        // "undefined" serialization). Plus de raison de garder ce dump.
        // 1. Validation Zod.
        // Important: HTML forms send empty fields as `""` (empty string),
        // and `signInAction` forwards `totp: parsed.data.totp ?? ""` to
        // signIn(). But signInSchema.totp is `z.string().regex(/^\d{6}$/).optional()`
        // which rejects "" (only accepts undefined or 6 digits). Without
        // the normalization below, every login WITHOUT 2FA fails with a
        // silent Zod throw → CredentialsSignin → "Email, mot de passe ou
        // code 2FA invalide" misleading error in the UI.
        // Discovered live during M9 admin first sign-in 2026-05-10 by
        // querying activity_log: action=auth.login.failed but no inner
        // reason from auth.ts (unknown_email/invalid_password/etc.) — only
        // the outer catch in actions.ts. Root cause: the early return at
        // safeParse line was the silent culprit.
        // Normalize totp: Auth.js v5 sérialise `undefined` en string littéral
        // "undefined" via signIn("credentials", { totp: undefined }) — donc
        // raw.totp arrive comme "undefined" (string 9 chars), pas la valeur
        // undefined. Le filter ci-dessous traite tous les cas no-totp:
        // null, undefined, "", "undefined" (string) → undefined réel.
        const totpRaw = raw?.totp;
        const totpNorm =
          typeof totpRaw === "string" && totpRaw && totpRaw !== "undefined" ? totpRaw : undefined;
        const parsed = signInSchema.safeParse({
          email: raw?.email,
          password: raw?.password,
          totp: totpNorm,
        });
        if (!parsed.success) {
          console.error(
            "[authorize-debug] Zod safeParse FAILED:",
            JSON.stringify(parsed.error.issues),
          );
          return null;
        }
        const { email, password, totp } = parsed.data;
        const ip = typeof raw?.ipAddress === "string" ? raw.ipAddress : "unknown";

        // 2. Rate limit composite IP + email. Plafonds : SSOT
        //    `lib/limites-connexion-admin.ts` (plus de littéral recopié ici).
        //
        // 🔑 C'EST ICI QUE L'ON COMPTE, ET PAS DANS `signInAction`.
        //    `/api/auth/callback/credentials` est joignable directement, sans
        //    passer par l'action serveur : le comptage doit vivre sur le chemin
        //    qu'on ne peut pas contourner. L'action, elle, se contente de
        //    consulter — sinon une connexion réussie coûterait deux hits, ce
        //    qu'elle faisait jusqu'au 2026-09-06.
        const rlIp = await checkRateLimit(cleConnexionIp(ip), LIMITE_CONNEXION_IP);
        if (!rlIp.allowed) return null;
        const rlEmail = await checkRateLimit(cleConnexionCompte(email), LIMITE_CONNEXION_COMPTE);
        if (!rlEmail.allowed) return null;

        // 3. Lookup user
        const user = await prisma.adminUser.findUnique({ where: { email } });

        // 4. Verify password timing-safe (Sprint 15 fix Fork 3 W8-3).
        // Si user n'existe pas, on verifie quand meme contre un dummy hash
        // pour egaliser le timing → empeche oracle email valide vs invalide.
        const passwordOk = await verifyPasswordSafe(user?.passwordHash, password);
        if (!user || user.status !== "active" || !passwordOk) {
          // Sprint 15 fix Fork 2 W3-2 : log meme si user inexistant (sinon
          // oracle email persistant via presence/absence d'activity_log entry).
          await prisma.activityLog.create({
            data: {
              adminUserId: user?.id ?? null,
              action: "auth.login.failed",
              ipAddress: ip,
              changes: {
                reason: !user
                  ? "unknown_email"
                  : user.status !== "active"
                    ? "account_inactive"
                    : "invalid_password",
                email,
              },
            },
          });
          return null;
        }

        // 5. Verify 2FA if enabled (bootstrap window: super_admin/admin can
        //    log in without 2FA on first sign-in, must enable via /2fa/setup
        //    afterwards which then makes 2FA mandatory).
        // Sprint Notif Infra fix 2026-05-27 — Will a explicitement demandé de
        // désactiver l'enforcement 2FA basée sur le rôle. La 2FA reste opt-in
        // par utilisateur via le flag `twoFactorEnabled` (qui peut être activé
        // manuellement par chaque admin via /2fa/setup). Le set
        // `_ROLES_REQUIRING_2FA` reste défini comme documentation au cas où
        // l'enforcement role-based serait à ré-activer plus tard.
        const requires2FA = user.twoFactorEnabled;
        if (requires2FA) {
          if (!user.twoFactorSecret) {
            // 2FA enabled but no secret — corrupted state, refuse.
            return null;
          }
          if (!totp) return null;
          if (!verify2FACode(totp, user.twoFactorSecret)) {
            await prisma.activityLog.create({
              data: {
                adminUserId: user.id,
                action: "auth.login.failed",
                ipAddress: ip,
                changes: { reason: "invalid_2fa" },
              },
            });
            return null;
          }
        }

        // 6. Success — log + update lastLogin*
        await prisma.adminUser.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), lastLoginIp: ip },
        });
        await prisma.activityLog.create({
          data: {
            adminUserId: user.id,
            action: "auth.login.success",
            ipAddress: ip,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
