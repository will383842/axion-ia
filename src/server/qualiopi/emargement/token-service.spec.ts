/**
 * Tests — token-service.ts
 *
 * Ce qui compte ici : un jeton révoqué ou expiré ne signe RIEN, même si son
 * HMAC est intact ; et un même lien reste utilisable sur plusieurs créneaux.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emargementToken: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/magic-token", () => ({
  signMagicToken: vi.fn(),
  verifyMagicToken: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { signMagicToken, verifyMagicToken } from "@/lib/magic-token";
import {
  calculerExpiration,
  creerTokenInscription,
  verifierToken,
  revoquerTokensInscription,
  FENETRE_APRES_FIN_MS,
} from "./token-service";

const mockPrisma = prisma as unknown as {
  emargementToken: {
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockSign = signMagicToken as ReturnType<typeof vi.fn>;
const mockVerify = verifyMagicToken as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSign.mockResolvedValue("tok.en");
  mockVerify.mockResolvedValue({ ok: true, resourceId: "enr-1" });
  mockPrisma.emargementToken.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.emargementToken.create.mockResolvedValue({ id: "tok-1" });
  // `$transaction(cb)` → exécute le callback avec le client mocké.
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
});

describe("calculerExpiration", () => {
  const MAINTENANT = new Date("2026-06-10T08:00:00.000Z");

  it("vaut fin de session + 48 h", () => {
    const fin = new Date("2026-06-11T17:00:00.000Z");
    expect(calculerExpiration(fin, MAINTENANT).getTime()).toBe(
      fin.getTime() + FENETRE_APRES_FIN_MS,
    );
  });

  it("ne rend JAMAIS un jeton né expiré, même si la session est finie depuis longtemps", () => {
    // Un admin qui génère un lien un mois après doit obtenir un lien UTILISABLE,
    // pas un lien mort qui n'expliquerait rien au stagiaire.
    const finAncienne = new Date("2026-05-01T17:00:00.000Z");
    const exp = calculerExpiration(finAncienne, MAINTENANT);
    expect(exp.getTime()).toBeGreaterThan(MAINTENANT.getTime());
    expect(exp.getTime()).toBe(MAINTENANT.getTime() + FENETRE_APRES_FIN_MS);
  });

  it("est pure — n'altère pas ses arguments", () => {
    const fin = new Date("2026-06-11T17:00:00.000Z");
    const avant = fin.getTime();
    calculerExpiration(fin, MAINTENANT);
    expect(fin.getTime()).toBe(avant);
  });
});

describe("creerTokenInscription", () => {
  it("révoque le jeton actif précédent AVANT d'en créer un nouveau", async () => {
    await creerTokenInscription({
      enrollmentId: "enr-1",
      dateFinSession: new Date("2026-06-11T17:00:00.000Z"),
      maintenant: new Date("2026-06-10T08:00:00.000Z"),
    });

    // Sans cela, l'index unique partiel ferait échouer l'insertion et l'admin
    // verrait une erreur Prisma brute.
    expect(mockPrisma.emargementToken.updateMany).toHaveBeenCalled();
    const arg = mockPrisma.emargementToken.updateMany.mock.calls[0]?.[0] as {
      where: { enrollmentId: string; revokedAt: null };
    };
    expect(arg.where.enrollmentId).toBe("enr-1");
    expect(arg.where.revokedAt).toBeNull();
    expect(mockPrisma.emargementToken.create).toHaveBeenCalled();
  });

  it("ne stocke JAMAIS le jeton en clair — seulement son SHA-256", async () => {
    const { token } = await creerTokenInscription({
      enrollmentId: "enr-1",
      dateFinSession: new Date("2026-06-11T17:00:00.000Z"),
    });

    const data = (
      mockPrisma.emargementToken.create.mock.calls[0]?.[0] as {
        data: { tokenHash: string };
      }
    ).data;
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.tokenHash).not.toBe(token);
    // Le clair ne doit apparaître dans AUCUN champ persisté.
    expect(JSON.stringify(data)).not.toContain(token);
  });

  it("crée et révoque dans la MÊME transaction", async () => {
    await creerTokenInscription({
      enrollmentId: "enr-1",
      dateFinSession: new Date("2026-06-11T17:00:00.000Z"),
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("verifierToken", () => {
  function ligne(over: Record<string, unknown> = {}) {
    return {
      id: "tok-1",
      enrollmentId: "enr-1",
      coachingId: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      usedAt: new Date(),
      ...over,
    };
  }

  it("accepte un jeton valide", async () => {
    mockPrisma.emargementToken.findUnique.mockResolvedValue(ligne());
    const r = await verifierToken("tok.en");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.enrollmentId).toBe("enr-1");
  });

  it("refuse un HMAC invalide sans même interroger la base", async () => {
    mockVerify.mockResolvedValue({ ok: false });
    const r = await verifierToken("forge");
    expect(r).toEqual({ ok: false, raison: "signature_invalide" });
    expect(mockPrisma.emargementToken.findUnique).not.toHaveBeenCalled();
  });

  it("refuse un jeton RÉVOQUÉ même si son HMAC est intact", async () => {
    // Session annulée (O7) : sans cela un stagiaire signerait une session qui
    // n'a jamais eu lieu.
    mockPrisma.emargementToken.findUnique.mockResolvedValue(ligne({ revokedAt: new Date() }));
    const r = await verifierToken("tok.en");
    expect(r).toEqual({ ok: false, raison: "revoque" });
  });

  it("refuse un jeton expiré", async () => {
    mockPrisma.emargementToken.findUnique.mockResolvedValue(
      ligne({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const r = await verifierToken("tok.en");
    expect(r).toEqual({ ok: false, raison: "expire" });
  });

  it("la RÉVOCATION prime sur l'expiration — le motif affiché doit être le vrai", async () => {
    mockPrisma.emargementToken.findUnique.mockResolvedValue(
      ligne({ revokedAt: new Date(), expiresAt: new Date(Date.now() - 1000) }),
    );
    expect(await verifierToken("tok.en")).toEqual({ ok: false, raison: "revoque" });
  });

  it("refuse un jeton absent de la base", async () => {
    mockPrisma.emargementToken.findUnique.mockResolvedValue(null);
    expect(await verifierToken("tok.en")).toEqual({ ok: false, raison: "inconnu" });
  });

  it("N'EST PAS à usage unique — le même lien sert à plusieurs créneaux", async () => {
    mockPrisma.emargementToken.findUnique.mockResolvedValue(ligne({ usedAt: new Date() }));
    expect((await verifierToken("tok.en")).ok).toBe(true);
    expect((await verifierToken("tok.en")).ok).toBe(true);
    expect((await verifierToken("tok.en")).ok).toBe(true);
  });

  it("horodate le PREMIER usage, de façon conditionnelle", async () => {
    mockPrisma.emargementToken.findUnique.mockResolvedValue(ligne({ usedAt: null }));
    await verifierToken("tok.en");
    const arg = mockPrisma.emargementToken.updateMany.mock.calls[0]?.[0] as {
      where: { usedAt: null };
    };
    // Conditionnel : deux onglets ouverts ne doivent pas s'écraser.
    expect(arg.where.usedAt).toBeNull();
  });
});

describe("revoquerTokensInscription", () => {
  it("ne révoque que les jetons ACTIFS et retourne leur nombre", async () => {
    mockPrisma.emargementToken.updateMany.mockResolvedValue({ count: 2 });
    const n = await revoquerTokensInscription({ enrollmentId: "enr-1", motif: "Session annulée" });
    expect(n).toBe(2);
    const arg = mockPrisma.emargementToken.updateMany.mock.calls[0]?.[0] as {
      where: { revokedAt: null };
      data: { revokedMotif: string };
    };
    expect(arg.where.revokedAt).toBeNull();
    expect(arg.data.revokedMotif).toBe("Session annulée");
  });

  it("tronque un motif trop long au lieu de faire échouer la révocation", async () => {
    mockPrisma.emargementToken.updateMany.mockResolvedValue({ count: 1 });
    await revoquerTokensInscription({ enrollmentId: "enr-1", motif: "x".repeat(900) });
    const arg = mockPrisma.emargementToken.updateMany.mock.calls[0]?.[0] as {
      data: { revokedMotif: string };
    };
    expect(arg.data.revokedMotif.length).toBe(500);
  });
});
