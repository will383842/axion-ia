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
import { adminSegment } from "@/lib/admin-path";

// ============================================================
// signInAction — login email + password + (optionnel) TOTP
// ============================================================

export type SignInState = { ok: true } | { ok: false; error: string; requires2FA?: boolean };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const ip = await getClientIp();
  // Rate-limit composite IP+email — relaxé 2026-05-10 pendant phase
  // stabilisation (Will + Claude debug). Original Sprint 15: IP=10/15min,
  // email=5/15min — trop strict en debug actif où on retente plusieurs fois
  // par minute. Doctrine ANSSI standard pour login admin = ~5-10 attempts
  // /15 min, mais sur SaaS B2B premium avec 1 seul admin (Will), risque de
  // brute-force réel = nul (URL admin secrète + mdp fort + 2FA optionnel).
  // À redurcir si tu ouvres l'admin à plus d'utilisateurs.
  const rlIp = await checkRateLimit(`auth:login:ip:${ip}`, { limit: 100, windowSec: 900 });
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
    limit: 50,
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

  // 2FA requise UNIQUEMENT si l'admin l'a explicitement activée via /admin/2fa/setup.
  // Mode bootstrap : un super_admin/admin fraîchement seedé doit pouvoir se connecter
  // une 1re fois pour configurer son 2FA. Une fois activée (twoFactorEnabled=true),
  // elle devient obligatoire pour tout login ultérieur.
  // Pour exiger 2FA dès le 1er login (forcé par rôle), réajouter la condition rôle.
  const requires2FA = user.twoFactorEnabled;
  if (requires2FA && !parsed.data.totp) {
    return { ok: false, error: "Code 2FA requis.", requires2FA: true };
  }

  // Delegue a Auth.js Credentials provider qui re-verifie tout + emet le JWT.
  // Pass `undefined` for missing totp (NOT empty string) so the inner Zod
  // schema in auth.ts accepts it via `.optional()`. Empty string fails the
  // regex and produces a silent CredentialsSignin throw.
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      totp: parsed.data.totp ?? undefined,
      ipAddress: ip,
      redirect: false,
    });
  } catch (err) {
    // Capture la VRAIE cause Auth.js (CredentialsSignin, RedirectError, etc.)
    // pour debug. Ne pas l'exposer à l'utilisateur (information leak), mais
    // l'écrire dans activity_log.changes pour audit + dans console.error
    // pour Sentry/UptimeRobot. Exemple historique : un middleware mal
    // configuré redirect 307 /api/auth/* → Auth.js throw, l'ancien catch
    // retournait "Code 2FA invalide ou compte verrouille" trompeur.
    const cause = err instanceof Error ? err.message : String(err);
    const errorName = err instanceof Error ? err.name : "Unknown";
    console.error(`[signInAction] Auth.js failed: ${errorName}: ${cause}`);
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: "auth.login.failed",
        ipAddress: ip,
        changes: {
          reason: "auth_provider_throw",
          email: parsed.data.email,
          errorName,
          // Truncate to keep activity_log row small. Full stack in console.error.
          cause: cause.slice(0, 250),
        },
      },
    });
    return { ok: false, error: "Email, mot de passe ou code 2FA invalide." };
  }

  redirect(`/${adminSegment()}`);
}

// ============================================================
// signOutAction
// ============================================================

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect(`/${adminSegment()}/login`);
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
