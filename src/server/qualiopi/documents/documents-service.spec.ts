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

// ─────────────────────────────────────────────────────────────────────────────
// Filigrane « COPIE »
// ─────────────────────────────────────────────────────────────────────────────

describe("generateDocument — détection de régénération", () => {
  /**
   * `documentGenere.count` sert DEUX usages : l'allocation du numéro séquentiel
   * (filtre `numero`) et la détection de régénération (filtre `type`). Les
   * distinguer est indispensable — les confondre ferait passer les tests pour de
   * mauvaises raisons.
   */
  function simulerDocumentsExistants(nb: number): void {
    mockPrisma.documentGenere.count.mockImplementation((args: unknown) => {
      const where = (args as { where: Record<string, unknown> }).where;
      return Promise.resolve(where["numero"] !== undefined ? 0 : nb);
    });
  }

  /** Le `where` utilisé pour décider s'il s'agit d'une régénération. */
  function whereDeDetection(): Record<string, unknown> | undefined {
    const appel = mockPrisma.documentGenere.count.mock.calls.find(
      (c) => (c[0] as { where: Record<string, unknown> }).where["numero"] === undefined,
    );
    return appel === undefined
      ? undefined
      : (appel[0] as { where: Record<string, unknown> }).where;
  }

  /** `estCopie` réellement écrit en base. */
  function estCopiePersiste(): unknown {
    return (mockPrisma.documentGenere.create.mock.calls[0]![0] as { data: { estCopie: unknown } })
      .data.estCopie;
  }

  it("un premier tirage n'est pas une copie", async () => {
    simulerDocumentsExistants(0);
    await generateDocument({
      type: "positionnement",
      buildElement,
      refs: { sessionId: "ses-1" },
    });
    expect(estCopiePersiste()).toBe(false);
  });

  it("un second tirage des MÊMES références est une copie", async () => {
    simulerDocumentsExistants(1);
    await generateDocument({
      type: "positionnement",
      buildElement,
      refs: { sessionId: "ses-1" },
    });
    expect(estCopiePersiste()).toBe(true);
  });

  it("🔴 deux stagiaires d'une MÊME session ne se marquent pas copie l'un l'autre", async () => {
    // Le bug : six types sont établis PAR STAGIAIRE mais n'étaient rattachés
    // qu'à la session. Sur une session de huit personnes, le premier contrat
    // était un original et les sept suivants étaient enregistrés « copie ».
    // La correspondance doit donc être EXACTE, références absentes comprises.
    simulerDocumentsExistants(0);
    await generateDocument({
      type: "positionnement",
      buildElement,
      refs: { sessionId: "ses-1", traineeId: "sta-2" },
    });

    const where = whereDeDetection();
    expect(where).toMatchObject({ sessionId: "ses-1", traineeId: "sta-2" });
    // Les références NON fournies sont comparées à `null`, pas ignorées : sans
    // cela, une pièce rattachée à la seule session serait confondue avec une
    // pièce rattachée à la session ET à un stagiaire.
    expect(where).toMatchObject({ clientId: null, coachingSessionId: null, formationId: null });
  });

  it("🔴 SANS aucune référence, on ne conclut pas — pas de compte, pas de copie", async () => {
    // Quatre types n'en portent aucune (inventaire des moyens, contrat de
    // sous-traitance, fiche formateur, facture 1-to-1). Le compte dégénérait en
    // « deuxième document de ce type jamais émis » : le contrat d'un AUTRE
    // sous-traitant était marqué copie, et la deuxième facture de l'histoire
    // aussi.
    simulerDocumentsExistants(42);
    await generateDocument({ type: "inventaire_moyens", buildElement });

    expect(estCopiePersiste()).toBe(false);
    expect(whereDeDetection()).toBeUndefined();
  });

  it("`estCopie: true` explicite l'emporte, sans interroger la base", async () => {
    simulerDocumentsExistants(0);
    await generateDocument({ type: "positionnement", buildElement, estCopie: true });
    expect(estCopiePersiste()).toBe(true);
    expect(whereDeDetection()).toBeUndefined();
  });

  it("🔴 le filigrane atteint RÉELLEMENT le gabarit, pas seulement la base", async () => {
    // ⚠️ Le défaut d'origine : `estCopie` était écrit en base et n'atteignait
    // jamais le PDF, `buildElement(numero)` ne recevant que le numéro. La base
    // disait « copie » et la pièce sortait identique à l'original — soit
    // exactement ce que le filigrane devait empêcher.
    simulerDocumentsExistants(1);
    const Gabarit = (_: { data: { numero: string; estCopie?: boolean } }) => null;

    await generateDocument({
      type: "positionnement",
      buildElement: (numero) => React.createElement(Gabarit, { data: { numero } }),
      refs: { sessionId: "ses-1" },
    });

    const rendu = mockRender.mock.calls[0]![0] as { props: { data: { estCopie?: boolean } } };
    expect(rendu.props.data.estCopie).toBe(true);
  });

  it("ne touche pas aux données du gabarit quand ce n'est pas une copie", async () => {
    simulerDocumentsExistants(0);
    const Gabarit = (_: { data: { numero: string; estCopie?: boolean } }) => null;

    await generateDocument({
      type: "positionnement",
      buildElement: (numero) => React.createElement(Gabarit, { data: { numero } }),
      refs: { sessionId: "ses-1" },
    });

    const rendu = mockRender.mock.calls[0]![0] as { props: { data: { estCopie?: boolean } } };
    expect(rendu.props.data.estCopie).toBeUndefined();
  });
});
