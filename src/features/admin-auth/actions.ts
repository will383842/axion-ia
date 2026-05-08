// Server Actions Auth admin (Sprint 15 / M8).
//
// Pattern : toutes les mutations admin passent par des Server Actions
// (CLAUDE.md §6 + plan M8). Validation Zod server-side, rate-limit Redis,
// activity log systematique.

"use server";

import { redirect } from "next/navigation";
import { signIn, signOut, auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generate2FASecret, verify2FACode } from "@/lib/auth-2fa";
import { verifyPasswordSafe } from "@/lib/auth-password";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { signInSchema, setup2FASchema, disable2FASchema } from "@/lib/schemas/auth";

const ADMIN_PREFIX = `/${process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9"}`;

// ============================================================
// signInAction — login email + password + (optionnel) TOTP
// ============================================================

export type SignInState = { ok: true } | { ok: false; error: string; requires2FA?: boolean };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const ip = await getClientIp();
  // Rate-limit composite IP+email (Sprint 15 fix Fork 3 W1-3)
  const rlIp = await checkRateLimit(`auth:login:ip:${ip}`, { limit: 10, windowSec: 900 });
  if (!rlIp.allowed) {
    return { ok: false, error: "Trop de tentatives. Réessayez dans 15 minutes." };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totp: formData.get("totp") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Email ou mot de passe invalide." };
  }
  const rlEmail = await checkRateLimit(`auth:login:email:${parsed.data.email}`, {
    limit: 5,
    windowSec: 900,
  });
  if (!rlEmail.allowed) {
    return { ok: false, error: "Trop de tentatives. Réessayez dans 15 minutes." };
  }

  // Pre-check pour distinguer "2FA manquant" de "credentials invalides".
  // Sprint 15 fix Fork 3 W8-3 : verifyPasswordSafe avec dummy hash si user
  // absent → timing constant, oracle email closed.
  const user = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email },
    select: { passwordHash: true, twoFactorEnabled: true, status: true, role: true },
  });
  const passwordOk = await verifyPasswordSafe(user?.passwordHash, parsed.data.password);
  if (!user || user.status !== "active" || !passwordOk) {
    return { ok: false, error: "Email ou mot de passe invalide." };
  }

  // 2FA mandatory pour super_admin/admin
  const requires2FA = user.twoFactorEnabled || user.role === "super_admin" || user.role === "admin";
  if (requires2FA && !parsed.data.totp) {
    return { ok: false, error: "Code 2FA requis.", requires2FA: true };
  }

  // Delegue a Auth.js Credentials provider qui re-verifie tout + emet le JWT
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      totp: parsed.data.totp ?? "",
      ipAddress: ip,
      redirect: false,
    });
  } catch {
    // Sprint 15 fix Fork 3 W3-3 : log explicite reason invalid_2fa cote action
    // (en plus du log dans Auth.js Credentials provider).
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: "auth.login.failed",
        ipAddress: ip,
        changes: { reason: "invalid_2fa_or_locked", email: parsed.data.email },
      },
    });
    return { ok: false, error: "Code 2FA invalide ou compte verrouille." };
  }

  redirect(ADMIN_PREFIX);
}

// ============================================================
// signOutAction
// ============================================================

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect(`${ADMIN_PREFIX}/login`);
}

// ============================================================
// setup2FAStartAction — genere secret + QR (avant validation)
// ============================================================

export type Setup2FAStartState =
  | { ok: true; secret: string; otpauthUrl: string }
  | { ok: false; error: string };

export async function setup2FAStartAction(): Promise<Setup2FAStartState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Session expirée." };

  // Sprint 15 fix Fork 3 W6-3 : tx atomique + log activity pour tracer
  // les races (2 tabs simultanes generent secret en parallele).
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.adminUser.findUnique({
      where: { id: session.user.id },
      select: { email: true, twoFactorEnabled: true },
    });
    if (!user) return { ok: false as const, error: "Utilisateur introuvable." };
    if (user.twoFactorEnabled) return { ok: false as const, error: "2FA déjà activée." };

    const { secret, otpauthUrl } = generate2FASecret(user.email);
    await tx.adminUser.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: secret },
    });
    await tx.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "auth.2fa.setup_started",
        ipAddress: await getClientIp(),
      },
    });
    return { ok: true as const, secret, otpauthUrl };
  });
  return result;
}

// ============================================================
// setup2FAConfirmAction — valide le 1er code TOTP et active 2FA
// ============================================================

export type Setup2FAConfirmState = { ok: true } | { ok: false; error: string };

export async function setup2FAConfirmAction(
  _prev: Setup2FAConfirmState,
  formData: FormData,
): Promise<Setup2FAConfirmState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Session expirée." };

  const parsed = setup2FASchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { ok: false, error: "Code invalide." };

  const user = await prisma.adminUser.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });
  if (!user?.twoFactorSecret) return { ok: false, error: "Setup 2FA non initialisé." };
  if (user.twoFactorEnabled) return { ok: false, error: "2FA déjà activée." };

  if (!verify2FACode(parsed.data.code, user.twoFactorSecret)) {
    return { ok: false, error: "Code 2FA incorrect." };
  }

  // Sprint 15 fix Fork 3 W5-3 : atomique update + activity log dans une tx
  const ip = await getClientIp();
  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: true, twoFactorVerified: true },
    }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "auth.2fa.enabled",
        ipAddress: ip,
      },
    }),
  ]);

  return { ok: true };
}

// ============================================================
// disable2FAAction — desactive 2FA (password + code requis)
// ============================================================

export type Disable2FAState = { ok: true } | { ok: false; error: string };

export async function disable2FAAction(
  _prev: Disable2FAState,
  formData: FormData,
): Promise<Disable2FAState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Session expirée." };

  const parsed = disable2FASchema.safeParse({
    password: formData.get("password"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const user = await prisma.adminUser.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, twoFactorSecret: true, role: true },
  });
  if (!user?.twoFactorSecret) return { ok: false, error: "2FA non activée." };

  if (user.role === "super_admin" || user.role === "admin") {
    return { ok: false, error: "2FA obligatoire pour ce rôle." };
  }

  const passwordOk = await verifyPasswordSafe(user.passwordHash, parsed.data.password);
  if (!passwordOk) return { ok: false, error: "Mot de passe incorrect." };

  if (!verify2FACode(parsed.data.code, user.twoFactorSecret)) {
    return { ok: false, error: "Code 2FA incorrect." };
  }

  // Sprint 15 fix Fork 3 W5-3 : update + log atomic — avant: 2 statements
  // separes, crash entre = 2FA disabled sans audit trace.
  const ip = await getClientIp();
  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorVerified: false,
        twoFactorSecret: null,
      },
    }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "auth.2fa.disabled",
        ipAddress: ip,
      },
    }),
  ]);

  return { ok: true };
}
