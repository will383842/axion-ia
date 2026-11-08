/**
 * Aperçu PDF d'un devis brouillon : accès admin seul, 200 application/pdf,
 * aucun effet de bord (ni numéro, ni R2, ni DocumentGenere, ni écriture DB).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockFindUnique = vi.fn();
const mockRender = vi.fn();
const mockGenerateDocument = vi.fn();
const mockUpload = vi.fn();
const mockNextNumero = vi.fn();
const mockPrismaEcriture = vi.fn();
let formulesActivesTest = false;

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

// Seule la lecture du devis est permise : toute autre méthode est une écriture.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      create: (...a: unknown[]) => mockPrismaEcriture(...a),
      update: (...a: unknown[]) => mockPrismaEcriture(...a),
      updateMany: (...a: unknown[]) => mockPrismaEcriture(...a),
    },
    documentGenere: { create: (...a: unknown[]) => mockPrismaEcriture(...a) },
    $transaction: (...a: unknown[]) => mockPrismaEcriture(...a),
  },
}));

vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: (...a: unknown[]) => mockRender(...a),
  storeAndSignPdf: (...a: unknown[]) => mockUpload(...a),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => mockGenerateDocument(...a),
}));
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => true,
  uploadToR2: (...a: unknown[]) => mockUpload(...a),
  getSignedUrlR2: (...a: unknown[]) => mockUpload(...a),
}));
vi.mock("@/server/qualiopi/numbering/allocate", () => ({
  nextNumero: (...a: unknown[]) => mockNextNumero(...a),
}));

vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: async () => ({
    identite: { raisonSociale: "Axion", site: "https://axion-ia.com" },
    regimeTva: "assujetti",
    tauxStandard: 20,
    certificationObtenue: false,
    formulesActives: formulesActivesTest,
  }),
}));

import { GET } from "./route";
import { SELECT_DEVIS_POUR_PDF } from "@/server/qualiopi/documents/donnees-pdf-devis";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";

const ID = "550e8400-e29b-41d4-a716-446655440001";

const DEVIS = {
  numero: "AXI-DEV-2026-001",
  statut: "brouillon",
  lignes: [{ designation: "Formation IA", quantite: 1, prixUnitaireHtCents: 150000 }],
  activite: null,
  refClient: null,
  financementSuggere: null,
  montantOpcoEstimeCents: null,
  resteAChargeCents: null,
  dateValidite: new Date("2026-12-31T00:00:00Z"),
  client: {
    type: "entreprise",
    raisonSociale: "Client SA",
    siret: null,
    adresse: null,
    adresseRue: null,
    adresseCodePostal: null,
    adresseVille: null,
    contactEmail: null,
  },
};

function appeler(id = ID) {
  return GET(
    { url: `http://localhost/api/qualiopi/devis/${id}/apercu` } as unknown as NextRequest,
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  formulesActivesTest = false;
  mockAuth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
  mockFindUnique.mockResolvedValue(DEVIS);
  mockRender.mockResolvedValue({
    buffer: Buffer.from("%PDF-1.4 test"),
    hashSha256: "x",
    sizeBytes: 13,
  });
});

describe("GET /api/qualiopi/devis/[id]/apercu", () => {
  it("refuse sans session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await appeler();
    expect(res.status).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("refuse un rôle non admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2", role: "client" } });
    const res = await appeler();
    expect(res.status).toBe(401);
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("brouillon : 200 application/pdf, sans cache partagé", async () => {
    const res = await appeler();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    expect(
      Buffer.from(await res.arrayBuffer())
        .toString()
        .startsWith("%PDF"),
    ).toBe(true);
  });

  it("le document rendu porte le filigrane APERÇU et le numéro du devis", async () => {
    const { collectPdfTextNormalized } =
      await import("@/server/qualiopi/documents/collect-pdf-text");
    await appeler();
    const element = mockRender.mock.calls[0]?.[0];
    const texte = collectPdfTextNormalized(element);
    expect(texte).toContain("APERÇU");
    expect(texte).toContain("AXI-DEV-2026-001");
  });

  it("aucun effet de bord : ni numéro, ni R2, ni DocumentGenere, ni écriture DB", async () => {
    await appeler();
    expect(mockNextNumero).not.toHaveBeenCalled();
    expect(mockGenerateDocument).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockPrismaEcriture).not.toHaveBeenCalled();
    expect(mockFindUnique).toHaveBeenCalledOnce();
  });

  it("devis déjà émis : 409, rien n'est rendu", async () => {
    mockFindUnique.mockResolvedValue({ ...DEVIS, statut: "envoye" });
    const res = await appeler();
    expect(res.status).toBe(409);
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("devis introuvable : 404 ; identifiant invalide : 404", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect((await appeler()).status).toBe(404);
    expect((await appeler("pas-un-uuid")).status).toBe(404);
  });

  it("le select lit `offre` (sinon l'aperçu d'un devis à formules est vide)", async () => {
    await appeler();
    expect(mockFindUnique.mock.calls[0]?.[0].select).toBe(SELECT_DEVIS_POUR_PDF);
    expect(SELECT_DEVIS_POUR_PDF.offre).toBe(true);
  });

  it("offre valide + interrupteur allumé : les formules arrivent au gabarit", async () => {
    formulesActivesTest = true;
    mockFindUnique.mockResolvedValue({ ...DEVIS, lignes: [], offre: offreFictive() });
    const res = await appeler();
    expect(res.status).toBe(200);
    const element = mockRender.mock.calls[0]?.[0];
    const { collectPdfTextNormalized } =
      await import("@/server/qualiopi/documents/collect-pdf-text");
    expect(collectPdfTextNormalized(element)).toContain("Formule A");
  });

  it("offre illisible : 422 avec un message clair, pas de 500", async () => {
    formulesActivesTest = true;
    mockFindUnique.mockResolvedValue({ ...DEVIS, offre: { v: 99 } });
    const res = await appeler();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("Offre du devis invalide");
    expect(mockRender).not.toHaveBeenCalled();
  });
});
