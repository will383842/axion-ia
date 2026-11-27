/**
 * Tests — le service accepte la version de mentions `devis-v1` pour la SEULE signature du client
 * d'un devis, scelle les versions fournies et garde le facteur `code_email` du consentement devis.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn(), update: vi.fn() },
    documentSignature: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    documentSignatureToken: { findUnique: vi.fn() },
    documentSignatureCode: { findFirst: vi.fn() },
    documentSignatureHorodatage: { create: vi.fn() },
    trainer: { findUnique: vi.fn() },
    adminUser: { findUnique: vi.fn() },
    devis: { count: vi.fn(async () => 0) },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(),
  },
}));
vi.mock("@/server/qualiopi/emargement/storage", () => ({
  storeSignatureImage: vi.fn(),
  supprimerImageSignature: vi.fn(),
}));
vi.mock("./scan-papier-storage", () => ({
  estCleScanPapier: vi.fn(() => false),
  stockerScanPapier: vi.fn(),
  supprimerScanPapier: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { storeSignatureImage } from "@/server/qualiopi/emargement/storage";
import { choixCanonique, sha256Choix, sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { signerDocument } from "./document-signature-service";
import { stockerScanPapier } from "./scan-papier-storage";
import { MENTION_VERSION_DOCUMENT } from "./mentions-document";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: Mock; update: Mock };
  documentSignature: { findFirst: Mock; findMany: Mock; create: Mock; count: Mock };
  documentSignatureToken: { findUnique: Mock };
  documentSignatureCode: { findFirst: Mock };
  documentSignatureHorodatage: { create: Mock };
  adminUser: { findUnique: Mock };
  $transaction: Mock;
};
const mockStore = storeSignatureImage as unknown as Mock;
const mockScan = stockerScanPapier as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const TOKEN = "55555555-5555-4555-8555-555555555555";
const NUMERO_PIECE = "AXI-DEV-2026-001";
const MAINTENANT = new Date("2026-11-10T10:00:00.123Z");
const RECU_LE = new Date("2026-11-10T09:59:58.000Z");
const POUVOIR_LE = new Date("2026-11-10T09:59:58.500Z");
const CODE_UTILISE_LE = new Date("2026-11-10T09:59:00.000Z");
const CGV = "2026-10-04";

const OFFRE = offreFictive();
const OFFRE_SHA = sha256Offre(OFFRE);
const CHOIX = choixCanonique({
  devisNumero: NUMERO_PIECE,
  offreSha256: OFFRE_SHA,
  formule: "abonnement",
  automatisationsRetenues: [],
  maintenanceRetenue: false,
  periodiciteMois: 1,
});
const DEVIS_FORMULES = {
  numero: NUMERO_PIECE,
  offre: OFFRE,
  offreSha256: OFFRE_SHA,
  dateValidite: new Date("2026-11-20T00:00:00.000Z"),
};

function piece(devis: Record<string, unknown> | null, type = "devis") {
  return {
    id: DOC,
    numero: NUMERO_PIECE,
    type,
    hashSha256: "c".repeat(64),
    metadata: {},
    sessionId: null,
    trainerId: null,
    annuleeAt: null,
    signatures: [],
    session: null,
    devisPortes: devis === null ? [] : [devis],
  };
}

const PORTEUR_JETON = {
  type: "signataire_jeton" as const,
  tokenId: TOKEN,
  partie: "client" as const,
};

/** Devis À FORMULES, client, signature renforcée (code consommé). */
function entreeFormules(over: Record<string, unknown> = {}) {
  return {
    documentGenereId: DOC,
    porteur: PORTEUR_JETON,
    methode: "trace" as const,
    partiesRequises: ["client", "axionia"] as const,
    imageDataUrl: "data:image/png;base64,AAAA",
    maintenant: MAINTENANT,
    cgvVersion: CGV,
    choixOffre: { choix: CHOIX, sha256: sha256Choix(CHOIX) },
    cgvAccepteeAt: RECU_LE,
    mentionVersion: "devis-v1" as const,
    consentementVersion: "devis-consent-c-v1" as const,
    renforcee: {
      declarationNom: "Camille  Durand",
      declarationFonction: "Gérante",
      pouvoirDeclareAt: POUVOIR_LE,
    },
    ipHash: "i".repeat(64),
    userAgentSha256: "u".repeat(64),
    ...over,
  };
}

/** Devis CLASSIQUE (sans offre), client, par lien. */
function entreeClassique(over: Record<string, unknown> = {}) {
  return {
    documentGenereId: DOC,
    porteur: PORTEUR_JETON,
    methode: "trace" as const,
    partiesRequises: ["client", "axionia"] as const,
    imageDataUrl: "data:image/png;base64,AAAA",
    maintenant: MAINTENANT,
    cgvVersion: CGV,
    mentionVersion: "devis-v1" as const,
    consentementVersion: "devis-consent-v1" as const,
    ...over,
  };
}

function donnees(): Record<string, unknown> {
  return mockPrisma.documentSignature.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
}
function attendRefus(res: unknown, raison: string) {
  expect(res).toStrictEqual({ ok: false, raison, message: expect.any(String) });
  expect(mockPrisma.documentSignature.create).not.toHaveBeenCalled();
  expect(mockStore).not.toHaveBeenCalled();
  expect(mockScan).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(DEVIS_FORMULES));
  mockPrisma.documentGenere.update.mockResolvedValue({ id: DOC });
  mockPrisma.documentSignature.findFirst.mockResolvedValue(null);
  mockPrisma.documentSignature.findMany.mockResolvedValue([{ partie: "client" }]);
  mockPrisma.documentSignature.count.mockResolvedValue(0);
  mockPrisma.documentSignature.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: args.data["id"],
      selfHash: args.data["selfHash"],
    }),
  );
  mockPrisma.documentSignatureToken.findUnique.mockResolvedValue({
    documentGenereId: DOC,
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    signataireQualite: "Gérante",
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    revokedAt: null,
  });
  mockPrisma.documentSignatureCode.findFirst.mockResolvedValue({
    id: "code-1",
    utiliseAt: CODE_UTILISE_LE,
  });
  mockPrisma.documentSignatureHorodatage.create.mockResolvedValue({ id: "h1" });
  mockPrisma.adminUser.findUnique.mockResolvedValue({
    name: "Williams Jullin",
    email: "w@axion.test",
    status: "active",
    role: "super_admin",
  });
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
  mockStore.mockResolvedValue({
    key: "emargement/2026/signatures/x.png",
    sha256: "a".repeat(64),
    mimeType: "image/png",
    sizeBytes: 10,
  });
  mockScan.mockResolvedValue({
    key: "emargement/2026/signatures/x.pdf",
    sha256: "b".repeat(64),
    mimeType: "application/pdf",
    sizeBytes: 10,
  });
});

describe("devis-v1 — signature du client", () => {
  it("🔴 devis à formules + code consommé : versions devis ET facteur `code_email` scellé", async () => {
    const res = await signerDocument(entreeFormules());
    expect(res).toMatchObject({ ok: true });
    const d = donnees();
    expect(d["mentionVersion"]).toBe("devis-v1");
    expect(d["consentementVersion"]).toBe("devis-consent-c-v1");
    expect(d["facteurVerification"]).toBe("code_email");
  });

  it("devis classique : versions devis, aucun facteur", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    const res = await signerDocument(entreeClassique());
    expect(res).toMatchObject({ ok: true });
    const d = donnees();
    expect(d["mentionVersion"]).toBe("devis-v1");
    expect(d["consentementVersion"]).toBe("devis-consent-v1");
    expect(d["facteurVerification"] ?? null).toBeNull();
  });

  it("sans `mentionVersion` : `MENTION_VERSION_DOCUMENT`, comme avant", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    const res = await signerDocument(
      entreeClassique({ mentionVersion: undefined, consentementVersion: undefined }),
    );
    expect(res).toMatchObject({ ok: true });
    const d = donnees();
    expect(d["mentionVersion"]).toBe(MENTION_VERSION_DOCUMENT);
    expect(d["consentementVersion"]).toBe("doc-consent-v1");
  });
});

describe("devis-v1 — refus avant tout stockage", () => {
  it("convention + devis-v1 : `porteur_non_autorise`, rien écrit, rien stocké", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null, "convention"));
    attendRefus(await signerDocument(entreeClassique()), "porteur_non_autorise");
  });

  it("devis + partie axionia + devis-v1 : refus", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    attendRefus(
      await signerDocument({
        documentGenereId: DOC,
        porteur: { type: "organisme_authentifie", adminId: "a1", partie: "axionia" },
        methode: "trace",
        partiesRequises: ["client", "axionia"],
        imageDataUrl: "data:image/png;base64,AAAA",
        maintenant: MAINTENANT,
        mentionVersion: "devis-v1",
        consentementVersion: "devis-consent-v1",
      }),
      "porteur_non_autorise",
    );
  });

  it("papier + devis-v1 : refus", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    attendRefus(
      await signerDocument({
        documentGenereId: DOC,
        porteur: {
          type: "reversement_papier",
          adminId: "a1",
          provider: "physical_signed",
          partie: "client",
          signataire: { nom: "Camille Durand", email: "camille@client.test", qualite: "Gérante" },
        },
        methode: "papier_scanne",
        partiesRequises: ["client", "axionia"],
        scanPdf: { octets: Buffer.from("%PDF-1.4 test") },
        maintenant: MAINTENANT,
        mentionVersion: "devis-v1",
      }),
      "porteur_non_autorise",
    );
  });

  it("devis-v1 avec un consentement `doc-consent-v1` : refus", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    attendRefus(
      await signerDocument(entreeClassique({ consentementVersion: "doc-consent-v1" })),
      "porteur_non_autorise",
    );
  });

  it("devis-v1 sans consentement explicite (défaut doc-consent-v1) : refus", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    attendRefus(
      await signerDocument(entreeClassique({ consentementVersion: undefined })),
      "porteur_non_autorise",
    );
  });

  it("devis client + `mentionVersion` inconnue (forcée) + consentement absent : refus, aucun stockage", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    attendRefus(
      await signerDocument(
        entreeClassique({
          mentionVersion: "xyz" as never,
          consentementVersion: undefined,
        }),
      ),
      "porteur_non_autorise",
    );
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("consentement devis sans `mentionVersion` devis : refus", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    attendRefus(
      await signerDocument(entreeClassique({ mentionVersion: undefined })),
      "porteur_non_autorise",
    );
  });
});
