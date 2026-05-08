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
import * as argon2 from "argon2";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";
import { verify2FACode } from "./lib/auth-2fa";
import { checkRateLimit } from "./lib/rate-limit";
import { signInSchema } from "./lib/schemas/auth";
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

const ROLES_REQUIRING_2FA: ReadonlySet<AdminRole> = new Set(["super_admin", "admin"]);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        totp: { label: "Code 2FA", type: "text" },
        ipAddress: { type: "hidden" },
      },
      async authorize(raw) {
        // 1. Validation Zod
        const parsed = signInSchema.safeParse({
          email: raw?.email,
          password: raw?.password,
          totp: raw?.totp,
        });
        if (!parsed.success) return null;
        const { email, password, totp } = parsed.data;
        const ip = typeof raw?.ipAddress === "string" ? raw.ipAddress : "unknown";

        // 2. Rate limit IP-based
        const rl = await checkRateLimit(`auth:login:${ip}`, { limit: 5, windowSec: 900 });
        if (!rl.allowed) return null;

        // 3. Lookup user
        const user = await prisma.adminUser.findUnique({ where: { email } });
        if (!user || user.status !== "active") return null;

        // 4. Verify password
        const passwordOk = await argon2.verify(user.passwordHash, password);
        if (!passwordOk) {
          await prisma.activityLog.create({
            data: {
              adminUserId: user.id,
              action: "auth.login.failed",
              ipAddress: ip,
              changes: { reason: "invalid_password" },
            },
          });
          return null;
        }

        // 5. Verify 2FA if enabled (mandatory for super_admin / admin)
        const requires2FA = user.twoFactorEnabled || ROLES_REQUIRING_2FA.has(user.role);
        if (requires2FA) {
          if (!user.twoFactorEnabled || !user.twoFactorSecret) {
            // Compte sans 2FA setup mais role exige 2FA → refus.
            // (Le user sera redirige vers /admin/2fa/setup au prochain login
            // une fois le password valide cote UI separement.)
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
