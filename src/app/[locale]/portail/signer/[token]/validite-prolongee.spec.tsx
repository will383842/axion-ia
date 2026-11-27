/**
 * Page publique de signature : mention de validité prolongée (lot E2). Le texte de consentement
 * n'est pas touché ; un devis `expire` reste bloqué.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { devis: { findFirst } } }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

import { PieceSignatureForm } from "@/components/portail/PieceSignatureForm";
import { lireDevisASigner } from "@/server/qualiopi/documents/signature/devis-signature-queries";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const base = {
  token: "t".repeat(40),
  numero: "AXI-DOC-2026-001",
  numeroDevis: "AXI-DEV-2026-014",
  dateValiditeLisible: "05/12/2026",
  organismeNom: "Axion-IA SAS",
  clientRaisonSociale: "Acme SAS",
  signataireNom: "Camille Durand",
  signataireQualite: "Directrice",
  lignes: [],
  totalHtLisible: "2 800,00 €",
  totalTtcLisible: "3 360,00 €",
  mentionTva: null,
  pieceLibelle: "devis",
  pdfUrl: "/pdf",
  mentions: ["J'ai pris connaissance du devis et je l'accepte."],
  cgv: { libelle: "01/01/2026", href: "/cgv", pdfHref: "/cgv.pdf", version: "v1" },
  signerAction: vi.fn(),
};

const rendre = (extra: Record<string, unknown> = {}) =>
  render(
    <PieceSignatureForm
      {...({ ...base, ...extra } as unknown as React.ComponentProps<typeof PieceSignatureForm>)}
    />,
  );

describe("page de signature — validité prolongée", () => {
  it("mention_affichee_si_dates_differentes", () => {
    rendre({ dateValiditeImprimee: "15/11/2026" });
    expect(screen.getByText(/Valable jusqu'au 05\/12\/2026\./)).toBeTruthy();
    expect(screen.getByTestId("validite-prolongee").textContent).toBe(
      " Validité prolongée par Axion-IA SAS : le PDF ci-dessous indique la date d'origine (15/11/2026) ; ses autres conditions sont inchangées.",
    );
  });

  it("aucune_mention_sinon", () => {
    rendre({ dateValiditeImprimee: "05/12/2026" });
    expect(screen.queryByTestId("validite-prolongee")).toBeNull();
    cleanup();
    rendre({ dateValiditeImprimee: null });
    expect(screen.queryByTestId("validite-prolongee")).toBeNull();
    cleanup();
    rendre();
    expect(screen.queryByTestId("validite-prolongee")).toBeNull();
  });

  it("expire_toujours_bloque", async () => {
    findFirst.mockResolvedValue({
      id: "d1",
      numero: "AXI-DEV-2026-014",
      statut: "expire",
      offre: null,
      dateValidite: new Date("2026-12-05T00:00:00Z"),
      montantTotalHtCents: 0,
      client: { raisonSociale: "Acme SAS" },
      documentGenere: { metadata: { renderData: { data: { dateValidite: "15/11/2026" } } } },
    });
    const r = await lireDevisASigner("doc1");
    expect(r?.statutBloquant).toBe("expire");
    expect(r?.dateValiditeImprimee).toBe("15/11/2026");
  });
});
