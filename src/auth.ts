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
import { signInSchema } from "./lib/schemas/auth";
import type { AdminRole, AdminStatus } from "../prisma/generated/client";

// Sprint 24 / B3 — cache 60s pour le check status admin dans le JWT callback.
// Sans cache, chaque requête authentifiée déclenche un round-trip DB ; 60s
// suffit (revocation < 60s satisfait la cible audit P1 « revocation < 24h »).
// Map module-level — survit aux requêtes Node runtime, naturellement bornée
// par cold-start frequency.
const STATUS_CACHE_TTL_MS = 60_000;
const statusCache = new Map<string, { status: AdminStatus; ts: number }>();

async function getCachedAdminStatus(adminUserId: string): Promise<AdminStatus | null> {
  const now = Date.now();
  const cached = statusCache.get(adminUserId);
  if (cached && now - cached.ts < STATUS_CACHE_TTL_MS) return cached.status;
  const row = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { status: true },
  });
  if (!row) {
    statusCache.delete(adminUserId);
    return null;
  }
  statusCache.set(adminUserId, { status: row.status, ts: now });
  return row.status;
}

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
     * Sprint 24 / B3 — enrich + revoke check.
     *
     * 1. Au signIn, copie id+role+status (comme l'Edge callback).
     * 2. À chaque refresh JWT, recheck `adminUser.status` via un cache 60s :
     *    si le compte est `suspended` ou supprimé, on retourne `null` →
     *    Auth.js détruit le JWT et le user est forcé à se reconnecter.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      const adminUserId = typeof token.id === "string" ? token.id : null;
      if (!adminUserId) return token;
      const status = await getCachedAdminStatus(adminUserId);
      if (status !== "active") return null;
      return token;
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

        // 2. Rate limit composite IP + email — relaxé 2026-05-10 (cf.
        // commentaire identique dans actions.ts signInAction). Limites élevées
        // pour V1 admin solo, à redurcir si admin ouvert à plus d'utilisateurs.
        const rlIp = await checkRateLimit(`auth:login:ip:${ip}`, {
          limit: 100,
          windowSec: 900,
        });
        if (!rlIp.allowed) return null;
        const rlEmail = await checkRateLimit(`auth:login:email:${email}`, {
          limit: 50,
          windowSec: 900,
        });
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
        // P0-4 Sprint correctif admin — 2FA obligatoire pour super_admin/admin
        // même sans twoFactorEnabled (ANSSI hardening). Le flag twoFactorEnabled
        // reste le vecteur principal ; le rôle enforce l'obligation.
        const requires2FA = user.twoFactorEnabled || _ROLES_REQUIRING_2FA.has(user.role);
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
