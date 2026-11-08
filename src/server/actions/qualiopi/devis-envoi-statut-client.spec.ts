/**
 * L'envoi d'un devis ne fait passer le client en « devis_envoye » que s'il est
 * encore PROSPECT : jamais un client actif (ou inactif, ou perdu) rétrogradé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  devisUpdate: vi.fn(),
  clientUpdate: vi.fn(),
  clientUpdateMany: vi.fn(),
  emettre: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: (...a: unknown[]) => h.findUnique(...a) },
    $transaction: async (f: (t: unknown) => unknown) =>
      f({
        devis: { update: h.devisUpdate },
        client: { update: h.clientUpdate, updateMany: h.clientUpdateMany },
        documentSignatureToken: { updateMany: vi.fn() },
      }),
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: vi.fn().mockResolvedValue({}),
  // Le rendu du PDF est fail-soft : on le fait échouer, l'envoi se poursuit sans pièce.
  donneesPdfDevis: vi.fn(() => {
    throw new Error("interception du test");
  }),
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: (...a: unknown[]) => h.emettre(...a),
  devisConcernesPourEmission: vi.fn(async () => []),
  emettreDevisSigne: vi.fn(),
  transactionDevisSigne: vi.fn(),
}));

import { sendDevisAction } from "./devis";

const ID = "550e8400-e29b-41d4-a716-446655440001";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.findUnique.mockResolvedValue({
    id: ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c1",
    statut: "brouillon",
    montantTotalHtCents: 150000,
    lignes: [],
    offre: null,
    replacesDevisId: null,
    replacesDevis: null,
    dateValidite: new Date("2026-12-31T00:00:00Z"),
    client: { type: "entreprise", raisonSociale: "Client SA", contactEmail: null },
  });
  h.clientUpdateMany.mockResolvedValue({ count: 1 });
});

describe("sendDevisAction — statut du client", () => {
  it("ne touche le client que s'il est prospect ou perdu (écriture gardée, jamais un client actif ou inactif)", async () => {
    const r = await sendDevisAction(ID);
    expect("data" in r).toBe(true);
    expect(h.clientUpdate).not.toHaveBeenCalled();
    expect(h.clientUpdateMany).toHaveBeenCalledOnce();
    expect(h.clientUpdateMany).toHaveBeenCalledWith({
      where: { id: "c1", statut: { in: ["prospect", "perdu"] } },
      data: { statut: "devis_envoye" },
    });
    // Même transaction que le passage du devis à « envoye ».
    expect(h.devisUpdate).toHaveBeenCalledOnce();
    expect(h.emettre).toHaveBeenCalledOnce();
  });

  it("0 ligne modifiée (client déjà actif ou plus avancé) : l'envoi réussit, sans erreur ni message trompeur", async () => {
    h.clientUpdateMany.mockResolvedValue({ count: 0 });
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(false);
    expect(h.devisUpdate).toHaveBeenCalledOnce();
    expect(h.emettre).toHaveBeenCalledOnce();
    const note = "data" in r ? (r.data.note ?? "") : "";
    expect(note).not.toMatch(/statut|rétrograd|client actif/i);
  });
});
