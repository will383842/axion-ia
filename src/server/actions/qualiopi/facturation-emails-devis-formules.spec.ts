/**
 * envoyerDevisEmailAction — devis à formules : échec FERMÉ si l'interrupteur est éteint
 * (sinon un renvoi révoquerait l'ancien lien et enverrait un lien refusé à la signature).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  findUnique: vi.fn(),
  docFindUnique: vi.fn(),
  creerToken: vi.fn(),
  enqueueEmail: vi.fn(),
  formulesActives: vi.fn(),
  log: vi.fn(),
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
  logQualiopiActivity: (...a: unknown[]) => d.log(...a),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: () => d.formulesActives(),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => d.creerToken(...a),
  TokenDocumentError: class extends Error {
    motif = "x";
  },
}));

import { envoyerDevisEmailAction } from "./facturation-emails";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";

const ID = "11111111-1111-4111-8111-111111111111";

function devis(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c1",
    statut: "envoye",
    offre: offreFictive(),
    documentGenereId: "doc-1",
    fichierPdfUrl: "documents/2026/devis/x.pdf",
    montantTotalHtCents: 0,
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
  d.formulesActives.mockResolvedValue(true);
  d.findUnique.mockResolvedValue(devis());
  d.docFindUnique.mockResolvedValue({ metadata: null });
  d.creerToken.mockResolvedValue({ token: "tok" });
  d.enqueueEmail.mockResolvedValue({ enqueued: true });
});

describe("envoyerDevisEmailAction — devis à formules", () => {
  it("interrupteur éteint : refus, aucun nouveau lien (l'ancien n'est pas révoqué), aucun e-mail", async () => {
    d.formulesActives.mockResolvedValue(false);
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("error" in r).toBe(true);
    expect(d.creerToken).not.toHaveBeenCalled();
    expect(d.enqueueEmail).not.toHaveBeenCalled();
  });

  it("interrupteur allumé : le renvoi passe", async () => {
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("data" in r).toBe(true);
    expect(d.creerToken).toHaveBeenCalledOnce();
  });

  it("devis classique, interrupteur éteint : renvoi inchangé", async () => {
    d.formulesActives.mockResolvedValue(false);
    d.findUnique.mockResolvedValue(devis({ offre: null, montantTotalHtCents: 1000 }));
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("data" in r).toBe(true);
  });

  it("statut autre que « envoye » : refus, aucun lien, aucun e-mail", async () => {
    d.findUnique.mockResolvedValue(devis({ statut: "accepte" }));
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("error" in r).toBe(true);
    expect(d.creerToken).not.toHaveBeenCalled();
    expect(d.enqueueEmail).not.toHaveBeenCalled();
  });

  it("sans pièce générée (documentGenereId null) : refus, aucun lien, aucun e-mail", async () => {
    d.findUnique.mockResolvedValue(devis({ documentGenereId: null }));
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("aucun e-mail sans lien de signature");
    expect(d.creerToken).not.toHaveBeenCalled();
    expect(d.enqueueEmail).not.toHaveBeenCalled();
  });

  it("lien de signature non créé : refus, aucun e-mail sans bouton signer", async () => {
    d.creerToken.mockRejectedValue(new Error("boom"));
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("error" in r).toBe(true);
    expect(d.enqueueEmail).not.toHaveBeenCalled();
  });

  it("devis classique : lien en échec reste fail-soft (e-mail part avec note)", async () => {
    d.findUnique.mockResolvedValue(devis({ offre: null, montantTotalHtCents: 1000 }));
    d.creerToken.mockRejectedValue(new Error("boom"));
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("data" in r).toBe(true);
    expect(d.enqueueEmail).toHaveBeenCalledOnce();
  });

  it("devis à formules, formules figées illisibles : aucun montant annoncé", async () => {
    d.findUnique.mockResolvedValue(devis({ montantTotalHtCents: 90000 }));
    d.docFindUnique.mockResolvedValue({ metadata: null });
    await envoyerDevisEmailAction({ devisId: ID });
    expect(d.enqueueEmail).toHaveBeenCalledOnce();
    const payload = d.enqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("montantLabel");
  });

  it("devis classique : le montant reste annoncé", async () => {
    d.findUnique.mockResolvedValue(devis({ offre: null, montantTotalHtCents: 90000 }));
    await envoyerDevisEmailAction({ devisId: ID });
    const payload = d.enqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload).toHaveProperty("montantLabel");
  });
});
