/**
 * Secret de double authentification chiffré au repos.
 *
 * Trois garanties :
 *   1. activer la 2FA écrit un secret CHIFFRÉ (jamais le secret en clair) ;
 *   2. un ancien secret en clair reste accepté (aucun verrouillage), puis est
 *      réécrit chiffré après une vérification réussie ;
 *   3. un code faux est refusé, que le secret stocké soit chiffré ou en clair.
 *
 * Couvre les deux chemins de vérification : la confirmation d'activation
 * (`setup2FAConfirmAction`) et la connexion (`authorize` de `src/auth.ts`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { current2FACode, generate2FASecret } from "@/lib/auth-2fa";
import { decryptPii, isEncryptedPii } from "@/lib/pii-crypto";
import { chiffrerSecret2FA, verifierCode2FAStocke } from "@/lib/auth-2fa-secret";

const h = vi.hoisted(() => ({
  configNextAuth: null as null | { providers: Array<{ authorize: (raw: unknown) => unknown }> },
  prisma: {
    adminUser: { findUnique: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "admin-1" } })),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next-auth", () => ({
  default: (config: typeof h.configNextAuth) => {
    h.configNextAuth = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (c: unknown) => c }));
vi.mock("@/auth.config", () => ({ authConfig: { callbacks: {} } }));
vi.mock("@/lib/auth-jeton-admin", () => ({ rafraichirJetonAdmin: vi.fn() }));
vi.mock("@/lib/auth-password", () => ({ verifyPasswordSafe: vi.fn(async () => true) }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  consulterRateLimit: vi.fn(),
  enregistrerTentative: vi.fn(),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(async () => "203.0.113.1") }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const CLE = "a".repeat(64);
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
const ID = "admin-1";

function poserCle(valeur: string | undefined): void {
  if (valeur === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = valeur;
}

/** Un code de 6 chiffres différent du code courant. */
function codeFaux(secret: string): string {
  const bon = Number(current2FACode(secret));
  return String((bon + 500_000) % 1_000_000).padStart(6, "0");
}

function formulaire(code: string): FormData {
  const f = new FormData();
  f.set("code", code);
  return f;
}

/** Données passées à `adminUser.update`, tous appels confondus. */
function ecritures(): Array<Record<string, unknown>> {
  return h.prisma.adminUser.update.mock.calls.map(
    (c) => (c[0] as { data: Record<string, unknown> }).data,
  );
}

beforeEach(() => {
  poserCle(CLE);
  vi.clearAllMocks();
  h.prisma.adminUser.update.mockImplementation(async (a: unknown) => a);
  h.prisma.activityLog.create.mockResolvedValue({});
  h.prisma.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(h.prisma)
      : Promise.all(arg as []),
  );
});
afterEach(() => poserCle(CLE_INITIALE));

describe("activation de la 2FA", () => {
  it("le secret enregistré n'est pas le secret en clair, et se déchiffre en lui", async () => {
    h.prisma.adminUser.findUnique.mockResolvedValue({
      email: "admin@example.com",
      twoFactorEnabled: false,
    });
    const { setup2FAStartAction } = await import("../actions");
    const res = await setup2FAStartAction();
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const stocke = ecritures()[0]?.["twoFactorSecret"] as string;
    expect(stocke).not.toBe(res.secret);
    expect(isEncryptedPii(stocke)).toBe(true);
    expect(stocke.length).toBeLessThanOrEqual(255); // colonne VarChar(255)
    expect(decryptPii(stocke, { aad: `admin_users:${ID}:two_factor_secret` })).toBe(res.secret);
  });
});

describe("confirmation de l'activation", () => {
  async function confirmer(stocke: string, code: string) {
    h.prisma.adminUser.findUnique.mockResolvedValue({
      twoFactorSecret: stocke,
      twoFactorEnabled: false,
    });
    const { setup2FAConfirmAction } = await import("../actions");
    return setup2FAConfirmAction({ ok: true }, formulaire(code));
  }

  it("ancien secret en clair : accepté, puis réécrit chiffré", async () => {
    const { secret } = generate2FASecret("admin@example.com");
    const res = await confirmer(secret, current2FACode(secret));
    expect(res).toEqual({ ok: true });
    const reecrit = ecritures()[0]?.["twoFactorSecret"] as string;
    expect(isEncryptedPii(reecrit)).toBe(true);
    expect(verifierCode2FAStocke(ID, current2FACode(secret), reecrit).valide).toBe(true);
  });

  it("secret chiffré : accepté, sans réécriture", async () => {
    const { secret } = generate2FASecret("admin@example.com");
    const res = await confirmer(chiffrerSecret2FA(ID, secret), current2FACode(secret));
    expect(res).toEqual({ ok: true });
    expect(ecritures()[0]).not.toHaveProperty("twoFactorSecret");
  });

  it.each([
    ["en clair", (s: string) => s],
    ["chiffré", (s: string) => chiffrerSecret2FA(ID, s)],
  ])("secret %s : un code faux est refusé, rien n'est écrit", async (_l, stocker) => {
    const { secret } = generate2FASecret("admin@example.com");
    const res = await confirmer(stocker(secret), codeFaux(secret));
    expect(res).toEqual({ ok: false, error: "Code 2FA incorrect." });
    expect(h.prisma.adminUser.update).not.toHaveBeenCalled();
  });
});

describe("connexion (authorize)", () => {
  async function connecter(stocke: string, totp: string) {
    h.prisma.adminUser.findUnique.mockResolvedValue({
      id: ID,
      email: "admin@example.com",
      name: "Admin",
      role: "admin",
      status: "active",
      passwordHash: "x",
      twoFactorEnabled: true,
      twoFactorSecret: stocke,
    });
    await vi.importActual<typeof import("@/auth")>("@/auth");
    const authorize = h.configNextAuth!.providers[0]!.authorize;
    return authorize({ email: "admin@example.com", password: "mot-de-passe-long", totp });
  }

  it("ancien secret en clair : connexion acceptée, secret réécrit chiffré", async () => {
    const { secret } = generate2FASecret("admin@example.com");
    const user = await connecter(secret, current2FACode(secret));
    expect(user).toMatchObject({ id: ID });
    const reecrit = ecritures()[0]?.["twoFactorSecret"] as string;
    expect(reecrit).not.toBe(secret);
    expect(isEncryptedPii(reecrit)).toBe(true);
  });

  it("secret chiffré : connexion acceptée, secret non réécrit", async () => {
    const { secret } = generate2FASecret("admin@example.com");
    const user = await connecter(chiffrerSecret2FA(ID, secret), current2FACode(secret));
    expect(user).toMatchObject({ id: ID });
    expect(ecritures()[0]).not.toHaveProperty("twoFactorSecret");
  });

  it.each([
    ["en clair", (s: string) => s],
    ["chiffré", (s: string) => chiffrerSecret2FA(ID, s)],
  ])("secret %s : un code faux est refusé", async (_l, stocker) => {
    const { secret } = generate2FASecret("admin@example.com");
    expect(await connecter(stocker(secret), codeFaux(secret))).toBeNull();
    expect(h.prisma.adminUser.update).not.toHaveBeenCalled();
  });
});

describe("verifierCode2FAStocke", () => {
  it("un chiffré recopié sur un autre compte est refusé", () => {
    const { secret } = generate2FASecret("admin@example.com");
    const chiffre = chiffrerSecret2FA("autre-compte", secret);
    expect(verifierCode2FAStocke(ID, current2FACode(secret), chiffre).valide).toBe(false);
  });

  it("sans clé : écriture en clair, vérification normale, rien à réécrire", () => {
    poserCle(undefined);
    const { secret } = generate2FASecret("admin@example.com");
    expect(chiffrerSecret2FA(ID, secret)).toBe(secret);
    expect(verifierCode2FAStocke(ID, current2FACode(secret), secret)).toEqual({
      valide: true,
      aReecrire: null,
    });
  });
});
