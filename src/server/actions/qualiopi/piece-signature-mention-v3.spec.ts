/**
 * L11-S1 — la mention « doc-v2 » n'est plus la mention courante : une page de signature
 * ouverte avant la mise en ligne de « doc-v3 » est refusée (`mention_perimee`), rien n'est écrit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CGV_VERSION } from "@/content/cgv-version";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    devis: { findFirst: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(async () => []) },
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
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (_: string): string | null => null })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/transmission-exemplaire", () => ({
  transmettreExemplaireSigne: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";

import { signerPieceParJetonAction } from "./piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as { documentGenere: { findUnique: Mock } };

beforeEach(() => {
  vi.clearAllMocks();
  (checkRateLimit as unknown as Mock).mockResolvedValue({ allowed: true });
  (verifierTokenDocument as unknown as Mock).mockResolvedValue({
    ok: true,
    tokenId: "22222222-2222-4222-8222-222222222222",
    documentGenereId: "11111111-1111-4111-8111-111111111111",
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    signataireQualite: "DRH",
  });
  mockPrisma.documentGenere.findUnique.mockResolvedValue({
    type: "mandat_opco",
    numero: "AXI-DOC-2026-041",
  });
});

function entree(version: string) {
  return {
    token: "jeton-en-clair",
    methode: "trace" as const,
    imageDataUrl: "data:image/png;base64,AAAA",
    cgvAcceptees: true as const,
    cgvVersionAffichee: CGV_VERSION,
    mentionVersionAffichee: version,
  };
}

describe("mention « doc-v2 » périmée depuis « doc-v3 »", () => {
  it("une page affichant doc-v2 est refusée, rien n'est écrit", async () => {
    const res = await signerPieceParJetonAction(entree("doc-v2"));
    expect(res).toMatchObject({ ok: false, raison: "mention_perimee" });
    expect(signerDocument).not.toHaveBeenCalled();
  });

  it("contre-témoin : doc-v3 passe la garde de version", async () => {
    (signerDocument as unknown as Mock).mockResolvedValue({
      ok: true,
      signatureId: "sig-1",
      selfHash: "a".repeat(64),
      statutSignature: "partielle",
    });
    const res = await signerPieceParJetonAction(entree("doc-v3"));
    expect(res).toMatchObject({ ok: true });
  });
});
