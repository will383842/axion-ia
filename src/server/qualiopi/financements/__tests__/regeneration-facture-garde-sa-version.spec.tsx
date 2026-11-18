// @vitest-environment node

/**
 * 🔴 Audit argent — une facture ou un avoir DÉJÀ ÉMIS se régénère avec la mise en page de
 * l'ORIGINAL (règle du fondateur : une pièce déjà envoyée garde exactement sa mise en page).
 *
 * Parcours réel : `genererPdfFactureFormation` → `generateDocument` (vrai) → PDF + instantané.
 * Seuls la base, le stockage et la numérotation sont simulés.
 *
 *  - pièce émise avant la v2 (aucune version dans son instantané) : PDF identique, octet pour
 *    octet, à celui de l'archive v1, et l'instantané garde `gabaritVersion: 1` ;
 *  - idem pour un avoir (même gabarit, alias `avoir → facture`) ;
 *  - facture NEUVE (jamais de PDF) : version courante, inscrite dans l'instantané.
 */

import { createHash } from "node:crypto";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const m = {
    facture: vi.fn(),
    origine: vi.fn(),
    cree: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: "doc-neuf", ...a.data })),
    pdfs: [] as Buffer[],
  };
  const prisma = {
    factureFormation: {
      findUnique: (...a: unknown[]) => m.facture(...a),
      update: vi.fn(async () => ({})),
    },
    trainingSession: { findUnique: vi.fn(async () => null) },
    documentGenere: {
      findUnique: (...a: unknown[]) => m.origine(...a),
      create: (a: { data: Record<string, unknown> }) => m.cree(a),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    activityLog: { create: vi.fn(async () => ({})) },
  };
  return { m, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/render", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/server/qualiopi/documents/render")>();
  return {
    ...reel,
    renderPdfToBuffer: async (el: React.ReactElement) => {
      const r = await reel.renderPdfToBuffer(el);
      h.m.pdfs.push(r.buffer);
      return r;
    },
  };
});
vi.mock("@/server/qualiopi/numbering/allocate", () => ({
  nextNumero: vi.fn(async () => "AXI-DOC-2026-0100"),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async () => 20),
}));
vi.mock("@/lib/legal-identity", () => ({ resolveRibFacture: vi.fn(async () => null) }));
vi.mock("@/server/qualiopi/documents/organisme", async () => {
  const { IDENTITE_FACTURE } =
    await import("../../documents/templates/__tests__/facture-cas.spec-util");
  return { getOrganismeIdentite: vi.fn(async () => IDENTITE_FACTURE) };
});

import { registerPdfTestFontsFallback } from "../../documents/register-pdf-test-fonts";
import { gabaritArchive } from "../../documents/templates/archives";
import { versionGabaritCourante } from "../../documents/templates/gabarit-versions";
import { FacturePdf } from "../../documents/templates/facture";
import { IDENTITE_FACTURE } from "../../documents/templates/__tests__/facture-cas.spec-util";
import { genererPdfFactureFormation } from "../facture-formation-emission";

beforeAll(() => {
  registerPdfTestFontsFallback();
  vi.useFakeTimers({ toFake: ["Date"] });
});
beforeEach(() => {
  vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
  h.m.cree.mockClear();
  h.m.origine.mockReset();
});
afterAll(() => {
  vi.useRealTimers();
});

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const EMISE = new Date("2026-11-05T10:00:00Z");

function ligneFacture(over: Record<string, unknown> = {}) {
  return {
    id: "fac-1",
    numero: "AXI-FACT-2026-014",
    destinataireNom: "SCI Invest Sun",
    destinataireSiret: "98765432100011",
    destinataireAdresse: "10 avenue du Client, 75008 Paris",
    destinataireTvaIntracom: null,
    refClient: null,
    montantHtCents: 280000,
    lignes: [{ designation: "Atelier IA — 2 jours", quantite: 1, prixUnitaireHtCents: 280000 }],
    regimeTva: "assujetti",
    subrogation: false,
    numeroDossierOpco: null,
    documentId: "doc-origine",
    emiseAt: EMISE,
    echeanceAt: new Date("2026-12-05T10:00:00Z"),
    sessionId: null,
    destinataire: null,
    session: null,
    ...over,
  };
}

/** Rend directement un composant avec les données que le parcours réel lui a données. */
async function pdfDe(Composant: React.ComponentType<{ data: never }>, data: unknown) {
  return renderToBuffer(
    React.createElement(Composant, { data: data as never }) as React.ReactElement<DocumentProps>,
  );
}

async function regenerer(over: Record<string, unknown>, origine: unknown) {
  h.m.facture.mockResolvedValue(ligneFacture(over));
  h.m.origine.mockResolvedValue(origine);
  const r = await genererPdfFactureFormation("fac-1");
  expect("error" in r).toBe(false);
  const cree = h.m.cree.mock.calls.at(-1)![0].data as {
    metadata: { renderData: { data: unknown; gabaritVersion: number } };
  };
  return cree.metadata.renderData;
}

describe("🔴 régénérer une pièce déjà émise garde la mise en page de l'original", () => {
  it("prérequis : la v2 est courante et la v1 archivée", () => {
    expect(versionGabaritCourante("facture")).toBe(2);
    expect(gabaritArchive("facture", 1)).not.toBeNull();
  });

  for (const [nom, origine] of [
    [
      "sans instantané de version (émise avant cette PR)",
      { metadata: { renderData: { data: {} } } },
    ],
    ["sans aucune métadonnée", { metadata: null }],
    ["avec une version 1 explicite", { metadata: { renderData: { gabaritVersion: 1 } } }],
  ] as const) {
    it(`facture ${nom} : PDF identique à la v1, instantané en v1`, async () => {
      const snap = await regenerer({}, origine);
      expect(snap.gabaritVersion).toBe(1);

      const v1 = await pdfDe(gabaritArchive("facture", 1) as never, snap.data);
      const rendu = await pdfDe(gabaritArchive("facture", 1) as never, snap.data);
      expect(sha(rendu)).toBe(sha(v1)); // déterminisme du harnais

      // Le PDF réellement produit par le parcours = celui de l'archive v1.
      const pdfReel = await dernierPdfReel();
      expect(sha(pdfReel)).toBe(sha(v1));
      // Et il diffère bien du rendu courant (sinon le test ne prouverait rien).
      const courant = await pdfDe(FacturePdf as never, snap.data);
      expect(sha(courant)).not.toBe(sha(v1));
    });
  }

  it("facture à montant négatif émise avant cette PR : PDF identique à la v1, instantané en v1", async () => {
    const snap = await regenerer(
      {
        numero: "AXI-FAC-2026-003",
        lignes: [
          { designation: "Atelier IA — remboursement", quantite: 1, prixUnitaireHtCents: -50000 },
        ],
        montantHtCents: -50000,
      },
      { metadata: { renderData: { data: {} } } },
    );
    expect(snap.gabaritVersion).toBe(1);
    const v1 = await pdfDe(gabaritArchive("facture", 1) as never, snap.data);
    expect(sha(await dernierPdfReel())).toBe(sha(v1));
    expect(sha(await pdfDe(FacturePdf as never, snap.data))).not.toBe(sha(v1));
  });

  it("une régénération d'une pièce déjà en v2 reste en v2", async () => {
    const snap = await regenerer({}, { metadata: { renderData: { gabaritVersion: 2 } } });
    expect(snap.gabaritVersion).toBe(2);
    expect(sha(await dernierPdfReel())).toBe(sha(await pdfDe(FacturePdf as never, snap.data)));
  });

  it("une facture NEUVE (aucun PDF d'origine) sort en v2 et l'inscrit", async () => {
    const snap = await regenerer({ documentId: null }, null);
    expect(snap.gabaritVersion).toBe(2);
    expect(h.m.origine).not.toHaveBeenCalled();
    expect(sha(await dernierPdfReel())).toBe(sha(await pdfDe(FacturePdf as never, snap.data)));
  });

  it("l'avoir NEUF (type « avoir ») s'inscrit en v2 via l'alias avoir → facture", async () => {
    const { generateDocument } = await import("../../documents/documents-service");
    await generateDocument({
      type: "avoir",
      identite: IDENTITE_FACTURE,
      element: React.createElement(FacturePdf, {
        data: { ...(await dataMinimale()), estAvoir: true },
      }),
    });
    const cree = h.m.cree.mock.calls.at(-1)![0].data as {
      metadata: { renderData: { gabaritVersion: number } };
    };
    expect(cree.metadata.renderData.gabaritVersion).toBe(2);
  });
});

async function dataMinimale() {
  const { CAS_FACTURE } = await import("../../documents/templates/__tests__/facture-cas.spec-util");
  return CAS_FACTURE[0]![1];
}

/** PDF effectivement rendu par le dernier `generateDocument` (capturé via renderPdfToBuffer). */
async function dernierPdfReel(): Promise<Buffer> {
  const b = h.m.pdfs.at(-1);
  if (!b) throw new Error("aucun PDF capturé");
  return b;
}
