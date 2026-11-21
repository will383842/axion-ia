/**
 * Tests — scan PDF d'un devis signé sur papier (lot I3, étape 2).
 *
 * `signerDocument` verse la copie numérisée comme signature de la partie client
 * (porteur `reversement_papier`, `physical_signed`, méthode `papier_scanne`).
 * Invariants : versions papier IMPOSÉES (D1), scan hors de son seul chemin
 * refusé AVANT R2, horodatage dans la même transaction, aucune orpheline.
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
    // Garde de version d'un devis (verrou de ligne puis relecture) : aucune ligne = rien à garder.
    devis: { count: vi.fn(async () => 0) },
    $queryRaw: vi.fn(async () => []),
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
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { storeSignatureImage } from "@/server/qualiopi/emargement/storage";
import { Prisma } from "../../../../../prisma/generated/client";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { signerDocument } from "./document-signature-service";
import { stockerScanPapier, supprimerScanPapier } from "./scan-papier-storage";
import {
  maillonDocumentDepuisLigne,
  COLONNES_V4_VIDES,
  HASH_VERSION_DOCUMENT,
  type LigneDocumentSignature,
} from "./document-signature-hash";
import { CONSENTEMENT_VERSION_DOCUMENT } from "./mentions-document";
import { CONSENTEMENT_VERSION_PAPIER, MENTION_VERSION_PAPIER } from "./mentions-papier";

type Mock = ReturnType<typeof vi.fn>;
const m = prisma as unknown as {
  documentGenere: { findUnique: Mock; update: Mock };
  documentSignature: { findFirst: Mock; findMany: Mock; create: Mock; count: Mock };
  documentSignatureToken: { findUnique: Mock };
  documentSignatureHorodatage: { create: Mock };
  adminUser: { findUnique: Mock };
  $transaction: Mock;
};
const mockStockerScan = stockerScanPapier as unknown as Mock;
const mockSupprimerScan = supprimerScanPapier as unknown as Mock;
const mockStoreImage = storeSignatureImage as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const NUMERO = "AXI-DEV-2026-001";
const MAINTENANT = new Date("2026-11-10T10:00:00.123Z");
const SHA_SCAN = "d".repeat(64);
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

const PORTEUR_PAPIER = {
  type: "reversement_papier" as const,
  adminId: ADMIN,
  provider: "physical_signed" as const,
  partie: "client" as const,
  signataire: { nom: "Camille Durand", email: "camille@client.test", qualite: "Gérante" },
};

function entree(over: Record<string, unknown> = {}) {
  return {
    documentGenereId: DOC,
    porteur: PORTEUR_PAPIER,
    methode: "papier_scanne" as const,
    partiesRequises: ["client", "axionia"] as const,
    scanPdf: { octets: OCTETS },
    maintenant: MAINTENANT,
    ipHash: "i".repeat(64),
    userAgentSha256: "u".repeat(64),
    ...over,
  };
}

function donnees(): Record<string, unknown> {
  return m.documentSignature.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
}
function attendRefus(res: unknown, raison: string) {
  expect(res).toStrictEqual({ ok: false, raison, message: expect.any(String) });
  expect(m.documentSignature.create).not.toHaveBeenCalled();
  expect(mockStockerScan).not.toHaveBeenCalled();
  expect(mockStoreImage).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  m.documentGenere.findUnique.mockResolvedValue(piece());
  m.documentGenere.update.mockResolvedValue({ id: DOC });
  m.documentSignature.findFirst.mockResolvedValue(null);
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
  m.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(m));
  mockStockerScan.mockResolvedValue({
    key: CLE_SCAN,
    sha256: SHA_SCAN,
    mimeType: "application/pdf",
    sizeBytes: OCTETS.byteLength,
  });
  mockSupprimerScan.mockResolvedValue(undefined);
});

describe("scan papier — ligne écrite", () => {
  it("écrit provider, méthode, mime, empreinte du scan, administrateur et versions papier", async () => {
    const res = await signerDocument(entree());
    expect(res).toMatchObject({ ok: true, statutSignature: "partielle" });

    expect(mockStockerScan).toHaveBeenCalledTimes(1);
    const arg = mockStockerScan.mock.calls[0]![0] as { octets: Buffer; signeAt: Date; id: string };
    expect(arg.octets).toBe(OCTETS);
    expect(arg.signeAt).toEqual(MAINTENANT);
    // L'identifiant de la ligne sert aussi de clé R2.
    expect(arg.id).toBe(donnees()["id"]);

    const d = donnees();
    expect(d).toMatchObject({
      provider: "physical_signed",
      methode: "papier_scanne",
      partie: "client",
      mimeType: "application/pdf",
      signatureKey: CLE_SCAN,
      signatureSha256: SHA_SCAN,
      sizeBytes: OCTETS.byteLength,
      recueilliParAdminId: ADMIN,
      mentionVersion: MENTION_VERSION_PAPIER,
      consentementVersion: CONSENTEMENT_VERSION_PAPIER,
      signataireNom: "Camille Durand",
      hashVersion: HASH_VERSION_DOCUMENT,
    });
    expect(mockStoreImage).not.toHaveBeenCalled();
  });

  it("crée la ligne d'horodatage dans la MÊME transaction (empreinte = selfHash)", async () => {
    await signerDocument(entree());
    expect(m.$transaction).toHaveBeenCalledTimes(1);
    expect(m.documentSignatureHorodatage.create).toHaveBeenCalledTimes(1);
    expect(m.documentSignatureHorodatage.create.mock.calls[0]![0]).toEqual({
      data: {
        signatureId: donnees()["id"],
        empreinteSha256: donnees()["selfHash"],
        prochainEssaiAt: MAINTENANT,
      },
    });
  });

  it("le selfHash écrit est revérifiable (tuple V3)", async () => {
    await signerDocument(entree());
    const d = donnees();
    const ligne: LigneDocumentSignature = {
      id: d["id"] as string,
      documentGenereId: DOC,
      provider: "physical_signed",
      providerSubmissionId: null,
      partie: "client",
      signataireNom: d["signataireNom"] as string,
      signataireEmail: d["signataireEmail"] as string | null,
      signataireQualite: d["signataireQualite"] as string | null,
      documentHashSha256: "c".repeat(64),
      methode: "papier_scanne",
      signatureSha256: d["signatureSha256"] as string | null,
      mentionVersion: d["mentionVersion"] as string,
      consentementVersion: d["consentementVersion"] as string,
      signeAt: MAINTENANT,
      prevHash: null,
      selfHash: d["selfHash"] as string,
      hashVersion: d["hashVersion"] as number,
      facteurVerification: null,
      cgvVersion: null,
      ...COLONNES_V4_VIDES,
    };
    const piece = { documentNumero: NUMERO, documentType: "devis" };
    expect(verifierChaine([maillonDocumentDepuisLigne(ligne, piece)]).valide).toBe(true);
    // Changer le scan après coup : la preuve le voit.
    expect(
      verifierChaine([
        maillonDocumentDepuisLigne({ ...ligne, signatureSha256: "e".repeat(64) }, piece),
      ]).valide,
    ).toBe(false);
  });
});

describe("scan papier — refus", () => {
  it("scanPdf avec un porteur à jeton : refus, sans R2", async () => {
    m.documentSignatureToken.findUnique.mockResolvedValue({
      documentGenereId: DOC,
      partie: "client",
      signataireNom: "Camille Durand",
      signataireEmail: null,
      signataireQualite: null,
      expiresAt: new Date("2027-01-01"),
      revokedAt: null,
    });
    const res = await signerDocument(
      entree({
        porteur: { type: "signataire_jeton", tokenId: "t".repeat(8), partie: "client" },
        methode: "papier_scanne",
      }),
    );
    attendRefus(res, "porteur_non_autorise");
  });

  it.each([
    ["signataire_jeton", { type: "signataire_jeton", tokenId: "t".repeat(8), partie: "client" }],
    ["organisme_authentifie", { type: "organisme_authentifie", adminId: ADMIN, partie: "client" }],
    [
      "fournisseur",
      { type: "fournisseur", submissionId: "sub-1", provider: "docuseal", partie: "client" },
    ],
  ])(
    "papier_scanne + image avec le porteur %s : porteur_non_autorise, sans R2",
    async (_n, porteur) => {
      const res = await signerDocument(
        entree({
          porteur,
          methode: "papier_scanne",
          scanPdf: undefined,
          imageDataUrl: "data:image/png;base64,AAAA",
        }),
      );
      attendRefus(res, "porteur_non_autorise");
    },
  );

  it.each([
    ["confirmation_accessible sans image", { methode: "confirmation_accessible" }],
    ["trace + image PNG", { methode: "trace", imageDataUrl: "data:image/png;base64,AAAA" }],
    ["papier_scanne + image PNG sans scanPdf", { imageDataUrl: "data:image/png;base64,AAAA" }],
  ])(
    "porteur reversement_papier hors scan PDF (%s) : porteur_non_autorise, sans R2 ni base",
    async (_n, extra) => {
      const res = await signerDocument(entree({ scanPdf: undefined, ...extra }));
      attendRefus(res, "porteur_non_autorise");
      expect(mockSupprimerScan).not.toHaveBeenCalled();
      expect(m.$transaction).not.toHaveBeenCalled();
    },
  );

  it("scanPdf avec une autre méthode que papier_scanne : refus", async () => {
    attendRefus(await signerDocument(entree({ methode: "trace" })), "image_interdite");
  });

  it("scanPdf ET imageDataUrl : refus", async () => {
    attendRefus(
      await signerDocument(entree({ imageDataUrl: "data:image/png;base64,AAAA" })),
      "image_interdite",
    );
  });

  it("papier_scanne sans rien : image_requise", async () => {
    attendRefus(await signerDocument(entree({ scanPdf: undefined })), "image_requise");
  });

  it("pièce annulée : refus avant R2", async () => {
    m.documentGenere.findUnique.mockResolvedValue(piece({ annuleeAt: new Date("2026-11-01") }));
    attendRefus(await signerDocument(entree()), "piece_annulee");
  });

  it("pièce spécimen : refus avant R2", async () => {
    m.documentGenere.findUnique.mockResolvedValue(piece({ metadata: { specimen: true } }));
    attendRefus(await signerDocument(entree()), "piece_specimen");
  });

  it("devis à formules : choix_requis, avant R2", async () => {
    const offre = offreFictive();
    m.documentGenere.findUnique.mockResolvedValue(
      piece({
        devisPortes: [
          {
            numero: NUMERO,
            offre,
            offreSha256: sha256Offre(offre),
            dateValidite: new Date("2026-12-01"),
          },
        ],
      }),
    );
    attendRefus(await signerDocument(entree()), "choix_requis");
  });

  it("consentementVersion fourni en papier : refus, sans R2", async () => {
    attendRefus(
      await signerDocument(entree({ consentementVersion: CONSENTEMENT_VERSION_DOCUMENT })),
      "porteur_non_autorise",
    );
    attendRefus(
      await signerDocument(entree({ consentementVersion: CONSENTEMENT_VERSION_PAPIER })),
      "porteur_non_autorise",
    );
  });

  it("version papier refusée pour une signature électronique", async () => {
    const res = await signerDocument({
      documentGenereId: DOC,
      porteur: { type: "organisme_authentifie", adminId: ADMIN, partie: "axionia" },
      methode: "trace",
      partiesRequises: ["client", "axionia"],
      imageDataUrl: "data:image/png;base64,AAAA",
      consentementVersion: CONSENTEMENT_VERSION_PAPIER,
      maintenant: MAINTENANT,
    });
    attendRefus(res, "porteur_non_autorise");
  });

  it("déjà signé (P2002) : deja_signe et le PDF écrit est supprimé", async () => {
    m.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    m.documentSignature.count.mockResolvedValue(1);
    const res = await signerDocument(entree());
    expect(res).toMatchObject({ ok: false, raison: "deja_signe" });
    expect(mockSupprimerScan).toHaveBeenCalledWith(CLE_SCAN);
  });

  it("erreur inattendue en transaction : le PDF orphelin est supprimé puis l'erreur remonte", async () => {
    m.$transaction.mockRejectedValue(new Error("boom"));
    await expect(signerDocument(entree())).rejects.toThrow("boom");
    expect(mockSupprimerScan).toHaveBeenCalledWith(CLE_SCAN);
  });
});
