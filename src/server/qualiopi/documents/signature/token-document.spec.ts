/**
 * Tests — token-document.ts (canal A).
 *
 * Trois familles d'invariants, et deux d'entre elles ne se voient pas en revue :
 *
 *  1. **L'émission REFUSE devant l'admin**, jamais devant le client. Un lien
 *     sans identité ou sans destinataire produirait une signature juridiquement
 *     anonyme, ou un lien rattaché à personne.
 *  2. **Un lien n'est jamais né expiré.** Le plancher garantit qu'un devis dont
 *     la validité est déjà courte reste signable — sinon l'admin envoie un lien
 *     mort sans le savoir.
 *  3. **Le motif d'expiration est DISTINGUÉ** de l'invalidité. C'est le défaut
 *     exact constaté le 2026-07-27 côté émargement : `verifyMagicToken` teste la
 *     signature d'abord et l'expiration ensuite, si bien qu'aplatir les deux
 *     rendait la branche `expire` morte pour tout jeton réellement périmé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentSignatureToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
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
  calculerExpirationDocument,
  creerTokenDocument,
  verifierTokenDocument,
  revoquerTokensDocument,
  TokenDocumentError,
  PLANCHER_VALIDITE_MS,
} from "./token-document";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentSignatureToken: { create: Mock; findUnique: Mock; updateMany: Mock };
  $transaction: Mock;
};
const mockSign = signMagicToken as unknown as Mock;
const mockVerify = verifyMagicToken as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const TOKEN_ID = "22222222-2222-4222-8222-222222222222";
const MAINTENANT = new Date("2026-07-30T09:00:00.000Z");

function ligne(over: Record<string, unknown> = {}) {
  return {
    id: TOKEN_ID,
    documentGenereId: DOC,
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    signataireQualite: "DRH",
    expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    revokedAt: null,
    usedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, PAS les valeurs de retour.
  mockSign.mockResolvedValue("jeton-en-clair");
  mockVerify.mockResolvedValue({ ok: true, scope: "document_signature", resourceId: DOC });
  mockPrisma.documentSignatureToken.create.mockResolvedValue({ id: TOKEN_ID });
  mockPrisma.documentSignatureToken.findUnique.mockResolvedValue(ligne());
  mockPrisma.documentSignatureToken.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
});

function entree(over: Record<string, unknown> = {}) {
  return {
    documentGenereId: DOC,
    partie: "client" as const,
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    borneMetier: new Date("2026-09-01T00:00:00.000Z"),
    maintenant: MAINTENANT,
    ...over,
  };
}

describe("calculerExpirationDocument — logique pure", () => {
  it("retient la borne métier quand elle est lointaine", () => {
    const borne = new Date("2026-09-01T00:00:00.000Z");
    expect(calculerExpirationDocument(borne, MAINTENANT).getTime()).toBe(borne.getTime());
  });

  it("🔴 n'émet JAMAIS un lien né expiré", () => {
    // Cas réel : un devis dont la date de validité est déjà passée. Sans le
    // plancher, l'admin enverrait un lien mort et le client lirait « expiré »
    // en essayant de signer, sans que personne comprenne pourquoi.
    const borne = new Date("2026-01-01T00:00:00.000Z");
    const exp = calculerExpirationDocument(borne, MAINTENANT);
    expect(exp.getTime()).toBe(MAINTENANT.getTime() + PLANCHER_VALIDITE_MS);
    expect(exp.getTime()).toBeGreaterThan(MAINTENANT.getTime());
  });

  it("applique le plancher quand la borne est plus proche que lui", () => {
    const borne = new Date(MAINTENANT.getTime() + 60 * 60 * 1000); // +1 h
    expect(calculerExpirationDocument(borne, MAINTENANT).getTime()).toBe(
      MAINTENANT.getTime() + PLANCHER_VALIDITE_MS,
    );
  });
});

describe("🔴 émission — le refus tombe devant l'ADMIN", () => {
  it("refuse un signataire sans nom", async () => {
    await expect(creerTokenDocument(entree({ signataireNom: "   " }))).rejects.toThrow(
      TokenDocumentError,
    );
    expect(mockPrisma.documentSignatureToken.create).not.toHaveBeenCalled();
  });

  it("refuse une adresse absente ou malformée", async () => {
    for (const email of ["", "   ", "pas-une-adresse"]) {
      await expect(creerTokenDocument(entree({ signataireEmail: email }))).rejects.toThrow(
        TokenDocumentError,
      );
    }
    expect(mockPrisma.documentSignatureToken.create).not.toHaveBeenCalled();
  });

  it("porte un motif exploitable, pas une erreur générique", async () => {
    await expect(creerTokenDocument(entree({ signataireNom: "" }))).rejects.toMatchObject({
      motif: "signataire_non_identifie",
    });
    await expect(creerTokenDocument(entree({ signataireEmail: "" }))).rejects.toMatchObject({
      motif: "destinataire_absent",
    });
  });
});

describe("émission — ce qui est écrit", () => {
  it("ne stocke JAMAIS le jeton en clair", async () => {
    const { token } = await creerTokenDocument(entree());
    const data = mockPrisma.documentSignatureToken.create.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(token).toBe("jeton-en-clair");
    expect(data["tokenHash"]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(data)).not.toContain("jeton-en-clair");
  });

  it("normalise l'adresse et fige l'identité", async () => {
    await creerTokenDocument(
      entree({ signataireEmail: "  Camille@Client.TEST  ", signataireQualite: " DRH " }),
    );
    const data = mockPrisma.documentSignatureToken.create.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(data["signataireEmail"]).toBe("camille@client.test");
    expect(data["signataireQualite"]).toBe("DRH");
    expect(data["signataireNom"]).toBe("Camille Durand");
  });

  it("🔴 révoque le jeton actif du MÊME couple avant d'en créer un neuf", async () => {
    // Deux liens vivants signifieraient qu'en révoquer un donne une fausse
    // impression de sécurité. L'index unique partiel l'impose de toute façon :
    // sans cette révocation, l'insertion échouerait sur une erreur Prisma brute.
    await creerTokenDocument(entree());
    expect(mockPrisma.documentSignatureToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentGenereId: DOC, partie: "client", revokedAt: null },
      }),
    );
  });

  it("scope le jeton à `document_signature`", async () => {
    // Un jeton d'émargement ne doit pas pouvoir signer une pièce contractuelle.
    await creerTokenDocument(entree());
    expect(mockSign).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "document_signature", resourceId: DOC }),
    );
  });
});

describe("🔴 vérification — motifs différenciés", () => {
  it("rend l'identité FIGÉE, relue en base", async () => {
    const res = await verifierTokenDocument("x");
    expect(res).toMatchObject({
      ok: true,
      tokenId: TOKEN_ID,
      documentGenereId: DOC,
      partie: "client",
      signataireNom: "Camille Durand",
      signataireEmail: "camille@client.test",
    });
  });

  it("distingue `expire` de `signature_invalide` sur un jeton JWT périmé", async () => {
    // 🔴 Sans cette distinction, la branche `expire` serait MORTE pour tout
    // jeton réellement périmé, et le client lirait « lien invalide » là où
    // « votre lien a expiré » lui aurait dit quoi faire.
    mockVerify.mockResolvedValue({ ok: false, reason: "expired" });
    expect(await verifierTokenDocument("x")).toStrictEqual({ ok: false, raison: "expire" });
  });

  it("fond les motifs de FORME dans `signature_invalide`", async () => {
    // Eux se rencontrent en trafiquant un jeton : les détailler renseignerait
    // un attaquant sur la structure attendue.
    for (const reason of ["malformed_payload", "scope_mismatch", "resource_mismatch"]) {
      mockVerify.mockResolvedValue({ ok: false, reason });
      expect(await verifierTokenDocument("x")).toStrictEqual({
        ok: false,
        raison: "signature_invalide",
      });
    }
  });

  it("🔴 la BASE reste l'autorité : révoqué prime sur un HMAC encore valide", async () => {
    mockPrisma.documentSignatureToken.findUnique.mockResolvedValue(
      ligne({ revokedAt: new Date("2026-07-29T00:00:00.000Z") }),
    );
    expect(await verifierTokenDocument("x")).toStrictEqual({ ok: false, raison: "revoque" });
  });

  it("refuse un jeton expiré EN BASE même si le HMAC passe", async () => {
    mockPrisma.documentSignatureToken.findUnique.mockResolvedValue(
      ligne({ expiresAt: new Date("2026-01-01T00:00:00.000Z") }),
    );
    expect(await verifierTokenDocument("x")).toStrictEqual({ ok: false, raison: "expire" });
  });

  it("rend `inconnu` quand la ligne n'existe pas", async () => {
    mockPrisma.documentSignatureToken.findUnique.mockResolvedValue(null);
    expect(await verifierTokenDocument("x")).toStrictEqual({ ok: false, raison: "inconnu" });
  });

  it("⚠️ ne CONSOMME pas le jeton — le client peut lire puis revenir signer", async () => {
    await verifierTokenDocument("x");
    // Seule la trace du premier usage est posée, et conditionnellement.
    expect(mockPrisma.documentSignatureToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TOKEN_ID, usedAt: null } }),
    );
    // Rien n'a été révoqué : le lien reste utilisable.
    const revocations = mockPrisma.documentSignatureToken.updateMany.mock.calls.filter(
      (c) => (c[0] as { data?: Record<string, unknown> })?.data?.["revokedAt"] != null,
    );
    expect(revocations).toStrictEqual([]);
  });

  it("ne réécrit pas `usedAt` sur un second passage", async () => {
    mockPrisma.documentSignatureToken.findUnique.mockResolvedValue(
      ligne({ usedAt: new Date("2026-07-30T08:00:00.000Z") }),
    );
    await verifierTokenDocument("x");
    expect(mockPrisma.documentSignatureToken.updateMany).not.toHaveBeenCalled();
  });
});

describe("révocation", () => {
  it("révoque tous les jetons actifs d'une pièce", async () => {
    const n = await revoquerTokensDocument({ documentGenereId: DOC, motif: "devis révisé" });
    expect(n).toBe(1);
    expect(mockPrisma.documentSignatureToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentGenereId: DOC, revokedAt: null } }),
    );
  });

  it("tronque un motif trop long plutôt que de violer le CHECK", async () => {
    await revoquerTokensDocument({ documentGenereId: DOC, motif: "x".repeat(900) });
    const data = mockPrisma.documentSignatureToken.updateMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect((data["revokedMotif"] as string).length).toBe(500);
  });
});
