/**
 * Tests — garde de version dans `signerDocument` : aucune signature sur une version de devis
 * déjà remplacée (verrou de ligne en PREMIÈRE instruction de la transaction).
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
    devis: { count: vi.fn() },
    trainer: { findUnique: vi.fn() },
    adminUser: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
vi.mock("@/server/qualiopi/emargement/storage", () => ({
  storeSignatureImage: vi.fn(),
  supprimerImageSignature: vi.fn(),
}));
vi.mock("./scan-papier-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./scan-papier-storage")>()),
  stockerScanPapier: vi.fn(),
  supprimerScanPapier: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { signerDocument } from "./document-signature-service";
import { stockerScanPapier, supprimerScanPapier } from "./scan-papier-storage";

type Mock = ReturnType<typeof vi.fn>;
const m = prisma as unknown as {
  documentGenere: { findUnique: Mock; update: Mock };
  documentSignature: { findFirst: Mock; findMany: Mock; create: Mock; count: Mock };
  documentSignatureHorodatage: { create: Mock };
  devis: { count: Mock };
  adminUser: { findUnique: Mock };
  $queryRaw: Mock;
  $transaction: Mock;
};
const mockStockerScan = stockerScanPapier as unknown as Mock;
const mockSupprimerScan = supprimerScanPapier as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const NUMERO = "AXI-DEV-2026-001";
const MAINTENANT = new Date("2026-11-10T10:00:00.123Z");
const CLE_SCAN = "documents/2026/devis-signes-papier/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf";
const OCTETS = Buffer.from("%PDF-1.7\n contenu \n%%EOF\n");

function piece(over: Record<string, unknown> = {}) {
  return {
    id: DOC,
    numero: NUMERO,
    type: "devis",
    hashSha256: "c".repeat(64),
    metadata: {},
    sessionId: null,
    trainerId: null,
    annuleeAt: null as Date | null,
    signatures: [],
    session: null,
    devisPortes: [
      { numero: NUMERO, offre: null, offreSha256: null, dateValidite: new Date("2026-12-01") },
    ],
    ...over,
  };
}

function entree(over: Record<string, unknown> = {}) {
  return {
    documentGenereId: DOC,
    porteur: {
      type: "reversement_papier" as const,
      adminId: ADMIN,
      provider: "physical_signed" as const,
      partie: "client" as const,
      signataire: { nom: "Camille Durand", email: "camille@client.test", qualite: "Gérante" },
    },
    methode: "papier_scanne" as const,
    partiesRequises: ["client", "axionia"] as const,
    scanPdf: { octets: OCTETS },
    maintenant: MAINTENANT,
    ipHash: "i".repeat(64),
    userAgentSha256: "u".repeat(64),
    ...over,
  };
}

let ordre: string[];

beforeEach(() => {
  vi.clearAllMocks();
  ordre = [];
  m.documentGenere.findUnique.mockResolvedValue(piece());
  m.documentGenere.update.mockResolvedValue({ id: DOC });
  m.documentSignature.findFirst.mockImplementation(async () => {
    ordre.push("findFirst");
    return null;
  });
  m.documentSignature.findMany.mockResolvedValue([{ partie: "client" }]);
  m.documentSignature.count.mockResolvedValue(0);
  m.documentSignature.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: args.data["id"],
      selfHash: args.data["selfHash"],
    }),
  );
  m.documentSignatureHorodatage.create.mockResolvedValue({ id: "h1" });
  m.adminUser.findUnique.mockResolvedValue({
    name: "Williams Jullin",
    email: "w@axion.test",
    status: "active",
    role: "super_admin",
  });
  m.$queryRaw.mockImplementation(async () => {
    ordre.push("garde");
    return [{ id: "devis-v1" }];
  });
  m.devis.count.mockResolvedValue(0);
  m.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(m));
  mockStockerScan.mockResolvedValue({
    key: CLE_SCAN,
    sha256: "d".repeat(64),
    mimeType: "application/pdf",
    sizeBytes: OCTETS.byteLength,
  });
  mockSupprimerScan.mockResolvedValue(undefined);
});

describe("signerDocument — garde de version d'un devis", () => {
  it("garde_premiere_instruction_de_la_transaction", async () => {
    await signerDocument(entree());
    expect(ordre[0]).toBe("garde");
    expect(ordre.indexOf("garde")).toBeLessThan(ordre.indexOf("findFirst"));
  });

  it("version_remplacee_refus_type_et_message", async () => {
    m.devis.count.mockResolvedValue(1);
    const res = await signerDocument(entree());
    expect(res).toStrictEqual({
      ok: false,
      raison: "version_remplacee",
      message: expect.stringContaining("version plus récente"),
    });
    expect(m.documentSignature.create).not.toHaveBeenCalled();
    expect(m.documentSignatureHorodatage.create).not.toHaveBeenCalled();
    expect(m.documentGenere.update).not.toHaveBeenCalled();
  });

  it("version_remplacee_nettoie_le_scan", async () => {
    m.devis.count.mockResolvedValue(1);
    await signerDocument(entree());
    expect(mockSupprimerScan).toHaveBeenCalledTimes(1);
    expect(mockSupprimerScan).toHaveBeenCalledWith(CLE_SCAN);
  });

  it("version_remplacee_jamais_reessayee", async () => {
    m.devis.count.mockResolvedValue(1);
    await signerDocument(entree());
    expect(m.$transaction).toHaveBeenCalledTimes(1);
  });

  it("piece_non_devis_aucune_requete_de_garde", async () => {
    m.documentGenere.findUnique.mockResolvedValue(piece({ type: "convention", devisPortes: [] }));
    await signerDocument(entree());
    expect(m.$queryRaw).not.toHaveBeenCalled();
    expect(m.devis.count).not.toHaveBeenCalled();
  });

  it("devis_sans_successeur_signature_inchangee", async () => {
    const res = await signerDocument(entree());
    expect(res).toMatchObject({ ok: true, statutSignature: "partielle" });
    expect(m.documentSignature.create).toHaveBeenCalledTimes(1);
    expect(m.documentSignatureHorodatage.create).toHaveBeenCalledTimes(1);
    expect(mockSupprimerScan).not.toHaveBeenCalled();
  });
});
