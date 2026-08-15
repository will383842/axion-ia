/**
 * Tests de non-régression — page publique de vérification d'un document.
 *
 * 🔴 Pourquoi ces tests existent : la mention d'ANNULATION s'était perdue entre
 * le registre admin (qui l'affiche depuis 2026-08-04) et cette page publique.
 * Le `select` Prisma ne demandait ni `annuleeAt`, ni `annuleeMotif`, ni
 * `remplaceeParNumero`, et le bandeau vert « Document authentique » était du
 * JSX inconditionnel : une attestation annulée par l'organisme lui-même — au
 * motif écrit « Évaluation des acquis non réalisée » — obtenait exactement le
 * même feu vert qu'une pièce valable. Un OPCO, un financeur ou un auditeur qui
 * scanne le QR d'une pièce périmée était trompé par le site de l'organisme.
 *
 * Ces tests gardent DEUX choses, et rougissent si l'une ou l'autre se reperd :
 *   1. les trois colonnes sont bien demandées au `select` (sans elles, la page
 *      ne PEUT pas savoir que la pièce a cessé de faire foi) ;
 *   2. les trois états sont bien rendus, et le vert est bien EXCLUSIF.
 *
 * Garde aussi la décision tranchée : on ne 404 PAS un QR déjà imprimé, on
 * affiche l'annulation et on renvoie vers la pièce qui fait foi.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks (déclarés avant les imports des modules testés)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import VerifierAttestationPage from "../page";

const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: ReturnType<typeof vi.fn> };
};
const mockNotFound = notFound as unknown as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN = "a".repeat(64);
const DATE_EMISSION = new Date("2026-03-12T09:00:00.000Z");
const DATE_ANNULATION = new Date("2026-04-02T14:30:00.000Z");
const MOTIF = "Évaluation des acquis non réalisée";

/** Même mise en forme que la page : garde la présence de la date, pas l'ICU. */
function dateFr(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

interface DocFixtureOverrides {
  estCopie?: boolean;
  annuleeAt?: Date | null;
  annuleeMotif?: string | null;
  remplaceeParNumero?: string | null;
}

function docFixture(overrides: DocFixtureOverrides = {}) {
  return {
    id: "doc-001",
    type: "attestation",
    numero: "AXI-ATT-2026-004",
    estCopie: false,
    createdAt: DATE_EMISSION,
    annuleeAt: null,
    annuleeMotif: null,
    remplaceeParNumero: null,
    session: {
      id: "ses-001",
      titreSession: "Prompt engineering pour dirigeants",
      dateDebut: new Date("2026-03-02T08:00:00.000Z"),
    },
    trainee: { prenom: "Camille", nom: "Dupont" },
    ...overrides,
  };
}

async function renderPage() {
  const ui = await VerifierAttestationPage({
    params: Promise.resolve({ locale: "fr", token: TOKEN }),
  });
  render(ui);
}

// ─────────────────────────────────────────────────────────────────────────────

const DATABASE_URL_INITIAL = process.env["DATABASE_URL"];

beforeEach(() => {
  // La page court-circuite en notFound() si la magic string de build est là
  // (ADR 0026) : on se place explicitement hors de ce chemin.
  process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
  mockPrisma.documentGenere.findUnique.mockReset();
  mockNotFound.mockReset();
  mockNotFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

afterAll(() => {
  if (DATABASE_URL_INITIAL === undefined) {
    delete process.env["DATABASE_URL"];
  } else {
    process.env["DATABASE_URL"] = DATABASE_URL_INITIAL;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Le select doit rapatrier de quoi juger la validité
// ─────────────────────────────────────────────────────────────────────────────

describe("select Prisma", () => {
  it("🔴 demande annuleeAt, annuleeMotif et remplaceeParNumero", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(docFixture());

    await renderPage();

    expect(mockPrisma.documentGenere.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { qrToken: TOKEN },
        select: expect.objectContaining({
          annuleeAt: true,
          annuleeMotif: true,
          remplaceeParNumero: true,
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Les trois états
// ─────────────────────────────────────────────────────────────────────────────

describe("bandeau de validité", () => {
  it("VERT — pièce ni annulée ni remplacée : document authentique", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(docFixture());

    await renderPage();

    expect(screen.getByText("Document authentique")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/ne fait plus foi/i)).toBeNull();
    expect(screen.queryByText(/plus en vigueur/i)).toBeNull();
    // Aucune ligne « Statut » parasite quand la pièce est saine.
    expect(screen.queryByText("Statut")).toBeNull();
  });

  it("🔴 ROUGE — pièce annulée : plus AUCUN feu vert, date et motif affichés", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      docFixture({ annuleeAt: DATE_ANNULATION, annuleeMotif: MOTIF }),
    );

    await renderPage();

    // Le feu vert doit avoir DISPARU — c'est là qu'était la non-conformité.
    expect(screen.queryByText("Document authentique")).toBeNull();

    const bandeau = screen.getByRole("alert");
    expect(bandeau.textContent).toContain("Document annulé — ne fait plus foi");
    expect(bandeau.textContent).toContain(dateFr(DATE_ANNULATION));
    expect(bandeau.textContent).toContain(MOTIF);

    // La date d'annulation est aussi portée par le tableau de synthèse.
    // NB : `&apos;` en JSX produit l'apostrophe droite U+0027, pas U+2019.
    expect(screen.getByText("Date d'annulation")).toBeInTheDocument();
    expect(screen.getByText("Annulé")).toBeInTheDocument();

    // Le bas de page ne doit plus affirmer la validité de la pièce.
    expect(screen.getByText(/plus opposable/i)).toBeInTheDocument();
  });

  it("🔴 AMBRE — pièce remplacée : renvoie vers le numéro qui fait foi", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      docFixture({ remplaceeParNumero: "AXI-ATT-2026-005" }),
    );

    await renderPage();

    expect(screen.queryByText("Document authentique")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();

    const bandeau = screen.getByRole("status");
    expect(bandeau.textContent).toContain("Document remplacé par AXI-ATT-2026-005");
    expect(bandeau.textContent).toContain("plus en vigueur");
    expect(screen.getByText("Remplacé par AXI-ATT-2026-005")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Combinaisons et décision tranchée
// ─────────────────────────────────────────────────────────────────────────────

describe("combinaisons de statuts", () => {
  it("annulation PRIME sur remplacement, et renvoie quand même vers la pièce en vigueur", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      docFixture({
        annuleeAt: DATE_ANNULATION,
        annuleeMotif: MOTIF,
        remplaceeParNumero: "AXI-ATT-2026-005",
      }),
    );

    await renderPage();

    const bandeau = screen.getByRole("alert");
    expect(bandeau.textContent).toContain("ne fait plus foi");
    expect(bandeau.textContent).toContain("AXI-ATT-2026-005");
    // Un seul bandeau : pas de double message contradictoire.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("le statut « Copie » survit et se cumule avec l'annulation", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      docFixture({ estCopie: true, annuleeAt: DATE_ANNULATION, annuleeMotif: MOTIF }),
    );

    await renderPage();

    expect(screen.getByText("Annulé · Copie")).toBeInTheDocument();
  });

  it("le statut « Copie » seul reste affiché sur une pièce valable", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(docFixture({ estCopie: true }));

    await renderPage();

    expect(screen.getByText("Document authentique")).toBeInTheDocument();
    expect(screen.getByText("Copie")).toBeInTheDocument();
  });

  it("un remplaceeParNumero vide ou blanc ne déclenche PAS le bandeau ambre", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      docFixture({ remplaceeParNumero: "  " }),
    );

    await renderPage();

    expect(screen.getByText("Document authentique")).toBeInTheDocument();
    expect(screen.queryByText(/plus en vigueur/i)).toBeNull();
  });
});

describe("décision tranchée : on conserve le token d'une pièce annulée", () => {
  it("ne 404 PAS une pièce annulée — un QR imprimé qui tombe sur 404 ferait croire à un faux", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      docFixture({ annuleeAt: DATE_ANNULATION, annuleeMotif: MOTIF }),
    );

    await renderPage();

    expect(mockNotFound).not.toHaveBeenCalled();
    expect(screen.getByText("AXI-ATT-2026-004")).toBeInTheDocument();
  });

  it("404 en revanche sur un token inconnu", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });
});
