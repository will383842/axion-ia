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
    sessionJour: {
      count: vi.fn(),
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
  TokenEmargementError,
  FENETRE_APRES_FIN_MS,
} from "./token-service";

const mockPrisma = prisma as unknown as {
  emargementToken: {
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  sessionJour: { count: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockSign = signMagicToken as ReturnType<typeof vi.fn>;
const mockVerify = verifyMagicToken as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSign.mockResolvedValue("tok.en");
  mockVerify.mockResolvedValue({ ok: true, resourceId: "enr-1" });
  mockPrisma.emargementToken.updateMany.mockResolvedValue({ count: 0 });
  // ⚠️ `clearAllMocks` efface les appels, pas les valeurs de retour : sans ce
  // repositionnement, `count` renverrait `undefined` et le garde-fou D14
  // passerait par accident au lieu de passer par choix.
  mockPrisma.sessionJour.count.mockResolvedValue(2);
  mockPrisma.emargementToken.create.mockResolvedValue({ id: "tok-1" });
  // `$transaction(cb)` → exécute le callback avec le client mocké.
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
});

describe("calculerExpiration", () => {
  const MAINTENANT = new Date("2026-06-10T08:00:00.000Z");

  it("🔴 vaut fin de session + 48 h — la valeur EXACTE de la décision D13", () => {
    // ⚠️ Comparer à `FENETRE_APRES_FIN_MS` ne prouve rien : ramener la constante
    // à 24 h laissait passer tous les tests. Or 48 h est une décision arbitrée,
    // prise contre ma recommandation initiale, et sa mitigation obligatoire est
    // l'affichage de l'écart sur le PDF — la changer en silence dissocierait les
    // deux. La date attendue est donc écrite en clair.
    const fin = new Date("2026-06-11T17:00:00.000Z");
    expect(calculerExpiration(fin, MAINTENANT).toISOString()).toBe("2026-06-13T17:00:00.000Z");
    expect(FENETRE_APRES_FIN_MS).toBe(48 * 60 * 60 * 1000);
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
  it("REFUSE d'émettre un lien si la session n'a déclaré aucune journée (D14)", async () => {
    // `emargement_signatures.heure_debut` / `heure_fin` sont NOT NULL : sans
    // journées déclarées, le service de signature n'aurait d'autre issue que
    // d'inventer un « 09h00–17h00 ». Le refus tombe devant l'ADMIN, qui peut
    // corriger, et non en salle devant le stagiaire, qui ne le peut pas.
    mockPrisma.sessionJour.count.mockResolvedValue(0);

    await expect(
      creerTokenInscription({
        enrollmentId: "enr-1",
        dateFinSession: new Date("2026-06-11T17:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ motif: "journees_non_declarees" });

    // Rien n'a été écrit : c'est l'invariant, pas le message.
    expect(mockPrisma.emargementToken.create).not.toHaveBeenCalled();
    expect(mockPrisma.emargementToken.updateMany).not.toHaveBeenCalled();
  });

  it("expose une erreur typée, pas une erreur Prisma brute", async () => {
    mockPrisma.sessionJour.count.mockResolvedValue(0);
    await expect(
      creerTokenInscription({ enrollmentId: "enr-1", dateFinSession: new Date() }),
    ).rejects.toBeInstanceOf(TokenEmargementError);
  });

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

describe("verifierToken — ancrages de sécurité", () => {
  it("passe TOUJOURS le scope `emargement` à la vérification HMAC", async () => {
    // C'est la seule chose qui empêche un jeton `formateur_login` ou
    // `booking_cancel` d'être rejoué sur la page publique d'émargement.
    // Sans cette assertion, retirer l'argument laissait tous les tests verts.
    mockPrisma.emargementToken.findUnique.mockResolvedValue({
      id: "tok-1",
      enrollmentId: "enr-1",
      coachingId: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
      usedAt: new Date(),
    });

    await verifierToken("tok.en");

    expect(mockVerify).toHaveBeenCalledWith("tok.en", { scope: "emargement" });
  });

  it("ignore le `resourceId` du jeton et fait autorité sur la LIGNE", async () => {
    // Sinon un jeton signé pourrait revendiquer l'inscription d'un autre.
    mockVerify.mockResolvedValue({ ok: true, resourceId: "enr-USURPEE" });
    mockPrisma.emargementToken.findUnique.mockResolvedValue({
      id: "tok-1",
      enrollmentId: "enr-REELLE",
      coachingId: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: null,
      usedAt: new Date(),
    });

    const res = await verifierToken("tok.en");
    expect(res).toMatchObject({ ok: true, enrollmentId: "enr-REELLE" });
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
