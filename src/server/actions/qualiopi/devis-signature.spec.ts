/**
 * Tests — devis-signature.ts (canal A).
 *
 * Ces tests sont nés d'une vérification E2E menée le 2026-07-30, qui a trouvé
 * DEUX trous dans du code déjà écrit, déjà typé et déjà couvert par 3 830 tests
 * verts. Aucun ne se voyait en revue de diff :
 *
 *  1. **Un devis REFUSÉ restait signable.** `declineDevisAction` posait
 *     `statut: "refuse"` sans toucher au jeton, et l'action de signature ne
 *     regardait JAMAIS le statut du devis — seule la PAGE le faisait. Or une
 *     page ne protège rien : l'action est appelable depuis un onglet resté
 *     ouvert. La signature se serait inscrite, chaînée et scellée, sur une pièce
 *     refusée — et `accepterDevisSurSignature` ne l'aurait pas rattrapée.
 *
 *  2. **Aucune limitation de débit** sur une action PUBLIQUE qui écrit jusqu'à
 *     3 Mo sur R2 avant d'ouvrir sa transaction, alors que le seul autre point
 *     de signature non authentifié du dépôt (`emargement-public.ts`) en pose
 *     deux.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findFirst: vi.fn(), updateMany: vi.fn() },
    documentSignature: { count: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: vi.fn(),
}));

vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: vi.fn(() => "iphash") }));
// ⚠️ `Headers.get()` rend `string | null`, JAMAIS `undefined`. Un `Map` nu rend
// `undefined` et ne reproduit donc PAS le contrat réel — la première version de
// ce mock faisait échouer onze tests sur une différence qui n'existe pas en
// production. Un mock infidèle teste autre chose que le code.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (_: string): string | null => null })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendTelegram } from "@/lib/telegram";
import { signerDevisParJetonAction } from "./devis-signature";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  devis: { findFirst: Mock; updateMany: Mock };
  documentSignature: { count: Mock };
};
const mockVerif = verifierTokenDocument as unknown as Mock;
const mockSigner = signerDocument as unknown as Mock;
const mockLimit = checkRateLimit as unknown as Mock;
const mockTelegram = sendTelegram as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const TOKEN_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, PAS les valeurs de retour.
  mockLimit.mockResolvedValue({ allowed: true });
  mockVerif.mockResolvedValue({
    ok: true,
    tokenId: TOKEN_ID,
    documentGenereId: DOC,
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    signataireQualite: "DRH",
  });
  mockPrisma.devis.findFirst.mockResolvedValue({ statut: "envoye", numero: "AXI-DEV-2026-004" });
  mockPrisma.devis.updateMany.mockResolvedValue({ count: 1 });
  mockSigner.mockResolvedValue({
    ok: true,
    signatureId: "sig-1",
    selfHash: "a".repeat(64),
    statutSignature: "partielle",
  });
  mockTelegram.mockResolvedValue(undefined);
});

function entree(over: Record<string, unknown> = {}) {
  return {
    token: "jeton-en-clair",
    methode: "trace" as const,
    imageDataUrl: "data:image/png;base64,AAAA",
    ...over,
  };
}

describe("🔴 le devis doit être ENCORE SIGNABLE — garde serveur", () => {
  it("accepte un devis `envoye`", async () => {
    const res = await signerDevisParJetonAction(entree());
    expect(res).toMatchObject({ ok: true });
    expect(mockSigner).toHaveBeenCalled();
  });

  it("🔴 REFUSE de signer un devis refusé — le trou trouvé le 2026-07-30", async () => {
    mockPrisma.devis.findFirst.mockResolvedValue({ statut: "refuse", numero: "AXI-DEV-2026-004" });
    const res = await signerDevisParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "devis_non_signable" });
    // Rien n'a été écrit : ni preuve, ni image sur R2.
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse aussi `expire` et `brouillon`", async () => {
    for (const statut of ["expire", "brouillon"]) {
      vi.clearAllMocks();
      mockLimit.mockResolvedValue({ allowed: true });
      mockVerif.mockResolvedValue({
        ok: true,
        tokenId: TOKEN_ID,
        documentGenereId: DOC,
        partie: "client",
        signataireNom: "X",
        signataireEmail: null,
        signataireQualite: null,
      });
      mockPrisma.devis.findFirst.mockResolvedValue({ statut, numero: "N" });
      const res = await signerDevisParJetonAction(entree());
      expect(res).toMatchObject({ ok: false, raison: "devis_non_signable" });
      expect(mockSigner).not.toHaveBeenCalled();
    }
  });

  it("dit « déjà accepté » plutôt que « plus en cours » sur un devis conclu", async () => {
    mockPrisma.devis.findFirst.mockResolvedValue({ statut: "accepte", numero: "N" });
    const res = await signerDevisParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "devis_non_signable" });
    if (res.ok) return;
    expect(res.message).toContain("déjà fait l'objet d'un accord");
  });

  it("refuse si aucun devis ne porte cette pièce", async () => {
    mockPrisma.devis.findFirst.mockResolvedValue(null);
    const res = await signerDevisParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "piece_introuvable" });
    expect(mockSigner).not.toHaveBeenCalled();
  });
});

describe("🔴 limitation de débit — action PUBLIQUE", () => {
  it("plafonne AVANT tout travail coûteux", async () => {
    mockLimit.mockResolvedValue({ allowed: false });
    const res = await signerDevisParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "trop_de_tentatives" });
    // 🔴 Le jeton n'est même pas vérifié : le plafond doit tomber en amont,
    // sinon il ne protège pas du travail qu'il est censé éviter.
    expect(mockVerif).not.toHaveBeenCalled();
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("plafonne par JETON et par IP", async () => {
    await signerDevisParJetonAction(entree());
    const cles = mockLimit.mock.calls.map((c) => String(c[0]));
    expect(cles.some((k) => k.startsWith("devis:sig:"))).toBe(true);
    expect(cles.some((k) => k.startsWith("devis:ip:"))).toBe(true);
  });

  it("⚠️ n'utilise JAMAIS le jeton en clair comme clé de plafond", async () => {
    // Une clé Redis contenant le jeton en clair le rendrait lisible par
    // quiconque inspecte le cache — c'est-à-dire signable.
    await signerDevisParJetonAction(entree());
    const cles = mockLimit.mock.calls.map((c) => String(c[0]));
    expect(cles.every((k) => !k.includes("jeton-en-clair"))).toBe(true);
  });
});

describe("🔴 personne ne doit ignorer qu'un client a signé", () => {
  it("alerte, en demandant la contresignature, quand la pièce reste partielle", async () => {
    await signerDevisParJetonAction(entree());
    expect(mockTelegram).toHaveBeenCalledTimes(1);
    const body = String(mockTelegram.mock.calls[0]?.[0]?.body ?? "");
    expect(body).toContain("AXI-DEV-2026-004");
    expect(body).toContain("CONTRESIGNER");
  });

  it("alerte différemment quand la pièce est intégralement signée", async () => {
    mockSigner.mockResolvedValue({
      ok: true,
      signatureId: "sig-2",
      selfHash: "b".repeat(64),
      statutSignature: "signee",
    });
    await signerDevisParJetonAction(entree());
    const body = String(mockTelegram.mock.calls[0]?.[0]?.body ?? "");
    expect(body).toContain("accepté");
    expect(mockPrisma.devis.updateMany).toHaveBeenCalled();
  });

  it("⚠️ une panne Telegram n'annule PAS une signature déjà chaînée", async () => {
    mockTelegram.mockRejectedValue(new Error("telegram down"));
    const res = await signerDevisParJetonAction(entree());
    expect(res).toMatchObject({ ok: true });
  });

  it("n'alerte pas sur un refus", async () => {
    mockPrisma.devis.findFirst.mockResolvedValue({ statut: "refuse", numero: "N" });
    await signerDevisParJetonAction(entree());
    expect(mockTelegram).not.toHaveBeenCalled();
  });
});
