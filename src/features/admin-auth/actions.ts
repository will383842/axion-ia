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
import { consulterRateLimit, enregistrerTentative } from "@/lib/rate-limit";
import {
  LIMITE_CONNEXION_COMPTE,
  LIMITE_CONNEXION_IP,
  cleConnexionCompte,
  cleConnexionIp,
} from "@/lib/limites-connexion-admin";
import { getClientIp } from "@/lib/client-ip";
import { signInSchema, setup2FASchema, disable2FASchema } from "@/lib/schemas/auth";
import { adminPath } from "@/lib/admin-path";

// ============================================================
// signInAction — login email + password + (optionnel) TOTP
// ============================================================

export type SignInState = { ok: true } | { ok: false; error: string; requires2FA?: boolean };

/**
 * 🔴 2026-08-19 (`D66-02`) — le compteur de connexion refuse désormais quand
 * Redis est injoignable, au lieu de laisser passer sans limite. La contrepartie
 * est de le DIRE : annoncer « trop de tentatives » à un administrateur qui n'en
 * a fait aucune l'enverrait chercher un verrouillage inexistant, et l'attente
 * de quinze minutes ne changerait rien à son sort.
 */
function messageRefus(panne: boolean): string {
  return panne
    ? "Connexion momentanément indisponible : le compteur de tentatives ne répond pas. Réessayez dans quelques minutes."
    : "Trop de tentatives. Réessayez dans 15 minutes.";
}

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  return _signInActionInner(_prev, formData);
}

async function _signInActionInner(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const ip = await getClientIp();
  // 🔴 ON CONSULTE ICI, ON NE COMPTE PAS. Cette action appelle plus bas
  // `signIn("credentials")`, dont `authorize()` verifie les MEMES cles : une
  // connexion reussie consommait donc deux hits, et c'est l'utilisateur
  // legitime qui payait le double comptage (l'attaquant, lui, rend la main
  // avant `signIn` sur un mot de passe faux — voir `limites-connexion-admin.ts`).
  //
  // ⚠️ Consulter ne suffit pas : les chemins qui rendent la main SANS appeler
  //    `signIn` doivent enregistrer la tentative eux-memes, sinon la force
  //    brute par mot de passe passe sous le compteur. C'est fait plus bas, a
  //    chaque `return` d'echec d'identifiants.
  const rlIp = await consulterRateLimit(cleConnexionIp(ip), LIMITE_CONNEXION_IP);
  if (!rlIp.allowed) {
    return { ok: false, error: messageRefus(rlIp.panne) };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totp: formData.get("totp") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Email ou mot de passe invalide." };
  }
  const rlEmail = await consulterRateLimit(
    cleConnexionCompte(parsed.data.email),
    LIMITE_CONNEXION_COMPTE,
  );
  if (!rlEmail.allowed) {
    return { ok: false, error: messageRefus(rlEmail.panne) };
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
    // 🔑 LE SEUL CHEMIN QUE LA FORCE BRUTE EMPRUNTE, et il rend la main sans
    //    jamais appeler `signIn` : c'est donc ICI que la tentative se compte.
    //    L'oublier rendrait le formulaire de connexion illimite tout en laissant
    //    les deux compteurs a l'air actifs.
    await Promise.all([
      enregistrerTentative(cleConnexionIp(ip), LIMITE_CONNEXION_IP),
      enregistrerTentative(cleConnexionCompte(parsed.data.email), LIMITE_CONNEXION_COMPTE),
    ]);
    return { ok: false, error: "Email ou mot de passe invalide." };
  }

  // Sprint Notif Infra fix 2026-05-27 — Will a explicitement demandé de
  // désactiver l'enforcement 2FA basée sur le rôle. La 2FA reste opt-in par
  // utilisateur via le flag `twoFactorEnabled` (chaque admin peut l'activer
  // manuellement via /2fa/setup s'il le souhaite).
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

  // 🔴 2026-08-21 — CES DEUX REDIRECTIONS OUBLIAIENT LA LANGUE.
  //
  // Elles visaient `/<prefixe-admin>`, sans `/fr`. Le proxy rattrapait par un
  // 301, donc « ça marchait » — au prix d'un aller-retour supplémentaire à
  // chaque connexion et à chaque déconnexion, et d'une URL intermédiaire que
  // tout code attendant l'arrivée voit passer. Le fixture e2e `loginAsAdmin`
  // s'y est arrêté.
  //
  // 🔑 `adminPath()` existait DÉJÀ, à côté, et fait exactement ça. La sœur de
  // cette fonction (`login/page.tsx`) écrivait `/fr/${adminPrefix}` à la main.
  // Trois écritures pour un seul chemin : elles ont divergé, comme toujours.
  redirect(adminPath("fr"));
}

// ============================================================
// signOutAction
// ============================================================

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect(adminPath("fr", "login"));
}

// ============================================================
// setup2FAStartAction — genere secret + QR (avant validation)
// ============================================================

export type Setup2FAStartState =
  { ok: true; secret: string; otpauthUrl: string } | { ok: false; error: string };

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

  // Sprint Notif Infra fix 2026-05-27 — Will a désactivé l'enforcement 2FA
  // role-based. Tout admin peut désactiver sa propre 2FA s'il l'avait activée.

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
