/**
 * Tests — piece-signature.ts (canal A).
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
    documentGenere: { findUnique: vi.fn() },
    devis: { findFirst: vi.fn(), updateMany: vi.fn() },
    documentSignature: { count: vi.fn(), findMany: vi.fn() },
    questionnaire: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/notifications/notifications-service", () => ({
  envoyerPositionnement: vi.fn(),
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
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendTelegram } from "@/lib/telegram";
import { envoyerPositionnement } from "@/server/qualiopi/notifications/notifications-service";
import { signerPieceParJetonAction } from "./piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: Mock };
  devis: { findFirst: Mock; updateMany: Mock };
  documentSignature: { count: Mock; findMany: Mock };
  questionnaire: { findMany: Mock; update: Mock };
};
const mockPositionnement = envoyerPositionnement as unknown as Mock;
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
  // La pièce est un DEVIS par défaut : c'est le seul type qui porte une
  // objection métier, donc celui qui exerce le plus de chemins.
  mockPrisma.documentGenere.findUnique.mockResolvedValue({
    type: "devis",
    numero: "AXI-DEV-2026-004",
  });
  mockPrisma.devis.findFirst.mockResolvedValue({ statut: "envoye" });
  mockPrisma.documentSignature.findMany.mockResolvedValue([]);
  mockPrisma.devis.updateMany.mockResolvedValue({ count: 1 });
  mockSigner.mockResolvedValue({
    ok: true,
    signatureId: "sig-1",
    selfHash: "a".repeat(64),
    statutSignature: "partielle",
  });
  mockTelegram.mockResolvedValue(undefined);
  mockPrisma.questionnaire.findMany.mockResolvedValue([]);
  mockPrisma.questionnaire.update.mockResolvedValue({});
  mockPositionnement.mockResolvedValue(undefined);
});

function entree(over: Record<string, unknown> = {}) {
  return {
    token: "jeton-en-clair",
    methode: "trace" as const,
    imageDataUrl: "data:image/png;base64,AAAA",
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Déclenchement automatique du positionnement (2026-08-15)
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 le positionnement part À LA CONCLUSION de la pièce qui engage l'action", () => {
  function conventionConclue() {
    mockPrisma.documentGenere.findUnique
      // 1er appel : lecture de la pièce par l'action.
      .mockResolvedValueOnce({ type: "convention", numero: "AXI-DOC-2026-032" })
      // 2e appel : lecture du rattachement session par le déclencheur.
      .mockResolvedValueOnce({ sessionId: "sess-1" });
    mockSigner.mockResolvedValue({
      ok: true,
      signatureId: "sig-1",
      selfHash: "a".repeat(64),
      statutSignature: "signee",
    });
  }

  it("envoie à CHAQUE stagiaire de la session, et pose la trace d'envoi", async () => {
    conventionConclue();
    mockPrisma.questionnaire.findMany.mockResolvedValue([{ id: "q-1" }, { id: "q-2" }]);

    const res = await signerPieceParJetonAction(entree());

    expect(res).toMatchObject({ ok: true });
    expect(mockPositionnement).toHaveBeenCalledTimes(2);
    expect(mockPositionnement).toHaveBeenNthCalledWith(1, "q-1");
    // 🔴 Sans `envoyeAt`, impossible de distinguer « jamais envoyé » de
    // « envoyé, sans réponse » — et la relance J+3 ne partirait jamais.
    expect(mockPrisma.questionnaire.update).toHaveBeenCalledTimes(2);
  });

  it("🔴 ne part PAS sur une signature PARTIELLE — la convention n'est pas conclue", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "convention",
      numero: "AXI-DOC-2026-032",
    });
    // `statutSignature: "partielle"` par défaut : le client a signé, l'organisme
    // n'a pas contresigné. Envoyer ici promettrait une formation non conclue.
    await signerPieceParJetonAction(entree());
    expect(mockPositionnement).not.toHaveBeenCalled();
  });

  it("🔴 IDEMPOTENT : ne cible que les questionnaires jamais envoyés ni répondus", async () => {
    conventionConclue();
    await signerPieceParJetonAction(entree());

    const where = (
      mockPrisma.questionnaire.findMany.mock.calls[0]![0] as {
        where: Record<string, unknown>;
      }
    ).where;
    // Ces trois gardes sont la raison pour laquelle ce chemin peut être
    // rejoué sans spammer le stagiaire. Les retirer casse ce test.
    expect(where["type"]).toBe("positionnement");
    expect(where["envoyeAt"]).toBeNull();
    expect(where["reponduAt"]).toBeNull();
    expect(where["enrollment"]).toMatchObject({ sessionId: "sess-1" });
  });

  it("un DEVIS intégralement signé ne déclenche aucun positionnement", async () => {
    // Un accord commercial n'engage pas encore une action de formation.
    mockSigner.mockResolvedValue({
      ok: true,
      signatureId: "sig-1",
      selfHash: "a".repeat(64),
      statutSignature: "signee",
    });
    await signerPieceParJetonAction(entree());
    expect(mockPositionnement).not.toHaveBeenCalled();
    // Le devis, lui, passe bien `accepte` : l'ajout n'a pas dérouté l'existant.
    expect(mockPrisma.devis.updateMany).toHaveBeenCalled();
  });

  it("🔴 une panne d'e-mail n'annule PAS une signature déjà écrite et chaînée", async () => {
    conventionConclue();
    mockPrisma.questionnaire.findMany.mockResolvedValue([{ id: "q-1" }]);
    mockPositionnement.mockRejectedValue(new Error("SMTP indisponible"));

    const res = await signerPieceParJetonAction(entree());

    expect(res).toMatchObject({ ok: true, statutSignature: "signee" });
  });

  it("une pièce sans session rattachée sort sans rien envoyer", async () => {
    mockPrisma.documentGenere.findUnique
      .mockResolvedValueOnce({ type: "convention", numero: "AXI-DOC-2026-032" })
      .mockResolvedValueOnce({ sessionId: null });
    mockSigner.mockResolvedValue({
      ok: true,
      signatureId: "sig-1",
      selfHash: "a".repeat(64),
      statutSignature: "signee",
    });

    const res = await signerPieceParJetonAction(entree());

    expect(res).toMatchObject({ ok: true });
    expect(mockPrisma.questionnaire.findMany).not.toHaveBeenCalled();
  });
});

describe("🔴 le devis doit être ENCORE SIGNABLE — garde serveur", () => {
  it("accepte un devis `envoye`", async () => {
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: true });
    expect(mockSigner).toHaveBeenCalled();
  });

  it("🔴 REFUSE de signer un devis refusé — le trou trouvé le 2026-07-30", async () => {
    mockPrisma.devis.findFirst.mockResolvedValue({ statut: "refuse" });
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
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
      mockPrisma.documentGenere.findUnique.mockResolvedValue({ type: "devis", numero: "N" });
      mockPrisma.devis.findFirst.mockResolvedValue({ statut });
      const res = await signerPieceParJetonAction(entree());
      expect(res).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
      expect(mockSigner).not.toHaveBeenCalled();
    }
  });

  it("dit « déjà accepté » plutôt que « plus en cours » sur un devis conclu", async () => {
    mockPrisma.devis.findFirst.mockResolvedValue({ statut: "accepte" });
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    if (res.ok) return;
    expect(res.message).toContain("déjà fait l'objet d'un accord");
  });

  it("refuse si aucun devis ne porte cette pièce", async () => {
    mockPrisma.devis.findFirst.mockResolvedValue(null);
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("refuse une pièce absente du registre", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(null);
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "piece_introuvable" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 une pièce NON signable au SSOT est refusée, même avec un jeton valide", async () => {
    // `facture`, `attestation`, `convocation`… sont des pièces ÉMISES, pas des
    // engagements négociés. Un jeton pointant dessus ne doit rien pouvoir écrire.
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "facture",
      numero: "AXI-FAC-2026-001",
    });
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "piece_non_signable" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("⚠️ une pièce SANS objection métier (convention) passe sans lire `devis`", async () => {
    // La généralisation ne doit pas exiger un devis pour toutes les pièces.
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "convention",
      numero: "AXI-CONV-2026-001",
    });
    mockPrisma.devis.findFirst.mockResolvedValue(null);
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: true });
    expect(mockPrisma.devis.findFirst).not.toHaveBeenCalled();
  });
});

describe("🔴 limitation de débit — action PUBLIQUE", () => {
  it("plafonne AVANT tout travail coûteux", async () => {
    mockLimit.mockResolvedValue({ allowed: false });
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "trop_de_tentatives" });
    // 🔴 Le jeton n'est même pas vérifié : le plafond doit tomber en amont,
    // sinon il ne protège pas du travail qu'il est censé éviter.
    expect(mockVerif).not.toHaveBeenCalled();
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("plafonne par JETON et par IP", async () => {
    await signerPieceParJetonAction(entree());
    const cles = mockLimit.mock.calls.map((c) => String(c[0]));
    expect(cles.some((k) => k.startsWith("piece:sig:"))).toBe(true);
    expect(cles.some((k) => k.startsWith("piece:ip:"))).toBe(true);
  });

  it("⚠️ n'utilise JAMAIS le jeton en clair comme clé de plafond", async () => {
    // Une clé Redis contenant le jeton en clair le rendrait lisible par
    // quiconque inspecte le cache — c'est-à-dire signable.
    await signerPieceParJetonAction(entree());
    const cles = mockLimit.mock.calls.map((c) => String(c[0]));
    expect(cles.every((k) => !k.includes("jeton-en-clair"))).toBe(true);
  });
});

describe("🔴 personne ne doit ignorer qu'un client a signé", () => {
  it("alerte, en demandant la contresignature, quand la pièce reste partielle", async () => {
    await signerPieceParJetonAction(entree());
    expect(mockTelegram).toHaveBeenCalledTimes(1);
    const body = String(mockTelegram.mock.calls[0]?.[0]?.body ?? "");
    expect(body).toContain("AXI-DEV-2026-004");
    // 🔴 L'alerte doit dire QUOI FAIRE, pas seulement que la pièce est
    // incomplète : « reste à signer : axionia » est actionnable.
    expect(body).toContain("Reste à signer");
    expect(body).toContain("axionia");
  });

  it("alerte différemment quand la pièce est intégralement signée", async () => {
    mockSigner.mockResolvedValue({
      ok: true,
      signatureId: "sig-2",
      selfHash: "b".repeat(64),
      statutSignature: "signee",
    });
    await signerPieceParJetonAction(entree());
    const body = String(mockTelegram.mock.calls[0]?.[0]?.body ?? "");
    expect(body).toContain("intégralement signée");
    expect(mockPrisma.devis.updateMany).toHaveBeenCalled();
  });

  it("⚠️ une panne Telegram n'annule PAS une signature déjà chaînée", async () => {
    mockTelegram.mockRejectedValue(new Error("telegram down"));
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: true });
  });

  it("n'alerte pas sur un refus", async () => {
    mockPrisma.devis.findFirst.mockResolvedValue({ statut: "refuse" });
    await signerPieceParJetonAction(entree());
    expect(mockTelegram).not.toHaveBeenCalled();
  });
});
