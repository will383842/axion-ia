/**
 * Tests — l'action de signature par lien choisit ET contrôle la version des mentions.
 *
 * Signature du CLIENT sur un DEVIS : `devis-v1` attendue, consentement devis scellé. Toute autre
 * pièce : `MENTION_VERSION_DOCUMENT`, comme avant. Le contrôle précède toute consommation de code.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    devis: { findFirst: vi.fn() },
    documentSignature: { count: vi.fn() },
  },
}));
const code = vi.hoisted(() => ({
  verifierCodeSignature: vi.fn(),
  restituerCodeSignature: vi.fn(async () => undefined),
}));
vi.mock("@/server/qualiopi/documents/signature/code-signature", () => code);
const echecs = vi.hoisted(() => ({ reinitialiserEchecsSignature: vi.fn(async () => undefined) }));
vi.mock("@/server/qualiopi/documents/signature/echecs-cumules", () => echecs);
const horodatage = vi.hoisted(() => ({ horodaterSignature: vi.fn(async () => "en_attente") }));
vi.mock("@/server/qualiopi/documents/signature/horodatage-signature", () => horodatage);
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: vi.fn(async () => ({ activationRefusee: null })),
  PREFIXE_ACTIVATION_REFUSEE: "x",
}));
const interrupteur = vi.hoisted(() => ({ formulesActives: vi.fn() }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => interrupteur);
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (_: string): string | null => null })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { CGV_VERSION } from "@/content/cgv-version";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { MENTION_VERSION_DOCUMENT } from "@/server/qualiopi/documents/signature/mentions-document";
import { MENTION_VERSION_DEVIS } from "@/server/qualiopi/documents/signature/mentions-devis";
import { checkRateLimit } from "@/lib/rate-limit";
import { sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { signerPieceParJetonAction } from "./piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: Mock };
  devis: { findFirst: Mock };
  documentSignature: { count: Mock };
};
const mockVerif = verifierTokenDocument as unknown as Mock;
const mockSigner = signerDocument as unknown as Mock;
const mockLimit = checkRateLimit as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const TOKEN_ID = "22222222-2222-4222-8222-222222222222";
const NUMERO = "AXI-DEV-2026-004";
const OFFRE = offreFictive();
const OFFRE_SHA = sha256Offre(OFFRE);

function entree(over: Record<string, unknown> = {}) {
  return {
    token: "jeton-en-clair",
    methode: "trace" as const,
    imageDataUrl: "data:image/png;base64,AAAA",
    cgvAcceptees: true as const,
    cgvVersionAffichee: CGV_VERSION,
    mentionVersionAffichee: MENTION_VERSION_DEVIS,
    ...over,
  };
}
const FORMULES = {
  declaration: { nom: "Camille Durand", fonction: "Gérante", pouvoirEngager: true },
  code: "123456",
  choix: {
    formule: "abonnement" as const,
    automatisationsRetenues: [] as string[],
    maintenanceRetenue: null,
    periodiciteMois: 1,
  },
};

function devisClassique() {
  mockPrisma.devis.findFirst.mockImplementation(
    async (args: { select: Record<string, boolean> }) =>
      args.select["statut"] === true
        ? { statut: "envoye" }
        : { numero: NUMERO, clientId: "client-1", offre: null, offreSha256: null },
  );
}
function devisFormules() {
  mockPrisma.devis.findFirst.mockImplementation(
    async (args: { select: Record<string, boolean> }) =>
      args.select["statut"] === true
        ? { statut: "envoye" }
        : { numero: NUMERO, clientId: "client-1", offre: OFFRE, offreSha256: OFFRE_SHA },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockResolvedValue({ allowed: true });
  code.verifierCodeSignature.mockResolvedValue({ ok: true, codeId: "code-1" });
  mockPrisma.documentSignature.count.mockResolvedValue(0);
  interrupteur.formulesActives.mockResolvedValue(true);
  mockVerif.mockResolvedValue({
    ok: true,
    tokenId: TOKEN_ID,
    documentGenereId: DOC,
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    signataireQualite: "Gérante",
  });
  mockPrisma.documentGenere.findUnique.mockResolvedValue({
    type: "devis",
    numero: NUMERO,
    metadata: {},
  });
  devisClassique();
  mockSigner.mockResolvedValue({
    ok: true,
    signatureId: "sig-1",
    selfHash: "a".repeat(64),
    statutSignature: "partielle",
  });
});

describe("devis, partie client — version devis-v1 attendue", () => {
  it("🔴 un devis qui poste la version courante des autres pièces : `mention_perimee`, aucun code consommé", async () => {
    devisFormules();
    const res = await signerPieceParJetonAction(
      entree({ mentionVersionAffichee: MENTION_VERSION_DOCUMENT, ...FORMULES }),
    );
    expect(res).toMatchObject({ ok: false, raison: "mention_perimee" });
    expect(mockSigner).not.toHaveBeenCalled();
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
  });

  it("devis classique qui poste `devis-v1` : le service reçoit les versions devis", async () => {
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: true });
    expect(mockSigner).toHaveBeenCalledWith(
      expect.objectContaining({
        mentionVersion: "devis-v1",
        consentementVersion: "devis-consent-v1",
      }),
    );
  });

  it("devis à formules (signature renforcée) : consentement « avec code » devis", async () => {
    devisFormules();
    const res = await signerPieceParJetonAction(entree({ ...FORMULES }));
    expect(res).toMatchObject({ ok: true });
    expect(mockSigner).toHaveBeenCalledWith(
      expect.objectContaining({
        mentionVersion: "devis-v1",
        consentementVersion: "devis-consent-c-v1",
      }),
    );
  });
});

describe("autres pièces — comportement inchangé", () => {
  beforeEach(() => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      type: "convention",
      numero: "AXI-DOC-2026-032",
      metadata: {},
    });
  });

  it("convention qui poste `devis-v1` : `mention_perimee`", async () => {
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "mention_perimee" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("convention qui poste `MENTION_VERSION_DOCUMENT` : passe, sans version devis", async () => {
    const res = await signerPieceParJetonAction(
      entree({ mentionVersionAffichee: MENTION_VERSION_DOCUMENT }),
    );
    expect(res).toMatchObject({ ok: true });
    const arg = mockSigner.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg["mentionVersion"]).toBeUndefined();
    expect(arg["consentementVersion"]).toBeUndefined();
  });
});
