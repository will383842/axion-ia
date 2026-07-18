/**
 * Tests — generateDocument (documents-service.ts).
 *
 * Cible le garde-fou de conformité SYSTÉMATIQUE : un document à valeur
 * juridique/fiscale (facture, convention…) est refusé si l'identité de l'OF est
 * incomplète, MÊME quand l'appelant ne passe pas `identite` (relecture config en
 * repli). Les types internes ne sont jamais bloqués. Le mode stub court-circuite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks (déclarés avant les imports des modules testés)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      count: vi.fn(),
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: vi.fn(),
  storeAndSignPdf: vi.fn(),
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { renderPdfToBuffer, storeAndSignPdf } from "@/server/qualiopi/documents/render";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { OrganismeIncompletError } from "@/server/qualiopi/documents/conformite";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";

const mockPrisma = prisma as unknown as {
  documentGenere: { count: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  activityLog: { create: ReturnType<typeof vi.fn> };
};
const mockRender = renderPdfToBuffer as ReturnType<typeof vi.fn>;
const mockStore = storeAndSignPdf as ReturnType<typeof vi.fn>;
const mockGetIdentite = getOrganismeIdentite as ReturnType<typeof vi.fn>;

const IDENTITE_VIDE = {
  raisonSociale: "",
  nda: "",
  qualiopi: "",
  siret: "",
  adresseSiege: "",
  adresseExercice: "",
  email: "",
  telephone: "",
  site: "",
};

const buildElement = () => React.createElement(React.Fragment);

let savedDbUrl: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedDbUrl = process.env["DATABASE_URL"];
  // Non-stub par défaut pour exercer le chemin persisté.
  process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
  mockRender.mockResolvedValue({
    buffer: Buffer.from("%PDF-"),
    hashSha256: "a".repeat(64),
    sizeBytes: 5,
  });
  mockStore.mockResolvedValue("https://r2/signed.pdf");
  mockPrisma.documentGenere.count.mockResolvedValue(0);
  mockPrisma.documentGenere.create.mockResolvedValue({
    id: "doc-1",
    numero: "AXI-FACT-2026-001",
    pdfUrl: "https://r2/signed.pdf",
    hashSha256: "a".repeat(64),
  });
  mockPrisma.activityLog.create.mockResolvedValue({});
});

afterEach(() => {
  if (savedDbUrl === undefined) delete process.env["DATABASE_URL"];
  else process.env["DATABASE_URL"] = savedDbUrl;
});

describe("generateDocument — garde-fou conformité systématique", () => {
  it("refuse une facture SANS identite quand la config OF est incomplète", async () => {
    mockGetIdentite.mockResolvedValue(IDENTITE_VIDE);

    await expect(generateDocument({ type: "facture", buildElement })).rejects.toBeInstanceOf(
      OrganismeIncompletError,
    );
    // La relecture config a bien eu lieu (identite non fournie).
    expect(mockGetIdentite).toHaveBeenCalledOnce();
    // Aucun document persisté.
    expect(mockPrisma.documentGenere.create).not.toHaveBeenCalled();
  });

  it("ne relit pas la config quand identite complète est fournie", async () => {
    await expect(
      generateDocument({
        type: "facture",
        buildElement,
        identite: {
          ...IDENTITE_VIDE,
          raisonSociale: "Axion-IA SAS",
          nda: "84691234567",
          siret: "12345678901234",
          adresseSiege: "1 rue de la Paix, 75001 Paris",
        },
      }),
    ).resolves.toMatchObject({ id: "doc-1" });
    expect(mockGetIdentite).not.toHaveBeenCalled();
  });

  it("laisse passer un type interne sans identite (pas de garde-fou)", async () => {
    const res = await generateDocument({ type: "positionnement", buildElement });
    expect(res).toMatchObject({ id: "doc-1" });
    // Type non soumis → jamais de relecture ni d'assert.
    expect(mockGetIdentite).not.toHaveBeenCalled();
  });

  it("mode stub.invalid → retourne l'objet stub sans throw ni DB", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const res = await generateDocument({ type: "facture", buildElement });
    expect(res.id).toBe("stub-id");
    expect(mockGetIdentite).not.toHaveBeenCalled();
    expect(mockPrisma.documentGenere.create).not.toHaveBeenCalled();
  });
});
