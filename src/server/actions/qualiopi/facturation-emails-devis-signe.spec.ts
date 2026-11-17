/**
 * envoyerDevisEmailAction — un devis déjà signé par le client, ou accepté, ne se renvoie pas :
 * le renvoi émettrait un nouveau lien et lui redemanderait de signer.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  findUnique: vi.fn(),
  docFindUnique: vi.fn(),
  creerToken: vi.fn(),
  enqueueEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: d.findUnique },
    documentGenere: { findUnique: d.docFindUnique },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => d.enqueueEmail(...a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "adm-1" }),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => true,
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => d.creerToken(...a),
  TokenDocumentError: class extends Error {
    motif = "x";
  },
}));

import { envoyerDevisEmailAction } from "./facturation-emails";

const ID = "11111111-1111-4111-8111-111111111111";
const MSG = "Ce devis est déjà signé par le client : le renvoyer lui redemanderait de signer.";

function devis(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c1",
    statut: "envoye",
    offre: null,
    documentGenereId: "doc-1",
    documentGenere: { annuleeAt: null, signatures: [] },
    fichierPdfUrl: "documents/2026/devis/x.pdf",
    montantTotalHtCents: 1000,
    dateValidite: new Date("2026-12-31T00:00:00Z"),
    client: {
      raisonSociale: "Client SA",
      contactEmail: "client@example.test",
      contactNom: "Camille",
      contactFonction: null,
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  d.findUnique.mockResolvedValue(devis());
  d.docFindUnique.mockResolvedValue({ metadata: null });
  d.creerToken.mockResolvedValue({ token: "tok" });
  d.enqueueEmail.mockResolvedValue({ enqueued: true });
});

describe("envoyerDevisEmailAction — devis signé ou accepté", () => {
  it("signé par le client : refus, aucun lien, aucun e-mail", async () => {
    d.findUnique.mockResolvedValue(
      devis({ documentGenere: { annuleeAt: null, signatures: [{ partie: "client" }] } }),
    );
    expect(await envoyerDevisEmailAction({ devisId: ID })).toEqual({ error: MSG });
    expect(d.creerToken).not.toHaveBeenCalled();
    expect(d.enqueueEmail).not.toHaveBeenCalled();
  });

  it.each(["accepte", "transforme_convention"])("statut « %s » : refus", async (statut) => {
    d.findUnique.mockResolvedValue(devis({ statut }));
    expect(await envoyerDevisEmailAction({ devisId: ID })).toEqual({ error: MSG });
    expect(d.enqueueEmail).not.toHaveBeenCalled();
  });

  it("contre-témoins : envoyé non signé, pièce annulée signée, contresignature seule → renvoi possible", async () => {
    expect("data" in (await envoyerDevisEmailAction({ devisId: ID }))).toBe(true);
    d.findUnique.mockResolvedValue(
      devis({ documentGenere: { annuleeAt: new Date(), signatures: [{ partie: "client" }] } }),
    );
    expect("data" in (await envoyerDevisEmailAction({ devisId: ID }))).toBe(true);
    d.findUnique.mockResolvedValue(
      devis({ documentGenere: { annuleeAt: null, signatures: [{ partie: "axionia" }] } }),
    );
    expect("data" in (await envoyerDevisEmailAction({ devisId: ID }))).toBe(true);
  });
});
