// Jonction demandes → clients : les candidats apporteurs n'y entrent pas.
//
// Un candidat apporteur n'achète rien. Compté parmi les « demandes », il
// gonflait le volume d'une origine et en faisait baisser le taux de
// conversion — un chiffre plausible, et faux, sur un écran qui oriente des
// dépenses publicitaires.

import { describe, it, expect, vi, beforeEach } from "vitest";

const lireSubmissions = vi.fn();
const lireClients = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findMany: (a: unknown) => lireSubmissions(a) },
    client: { findMany: (a: unknown) => lireClients(a) },
    devis: { count: async () => 0 },
    factureFormation: {
      aggregate: async () => ({ _count: { _all: 0 }, _sum: { montantHtCents: null } }),
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));

const { chargerTunnelVente } = await import("../vente");

beforeEach(() => {
  vi.clearAllMocks();
  lireClients.mockResolvedValue([]);
});

describe("chargerTunnelVente — périmètre des demandes", () => {
  it("n'y compte pas les candidats apporteurs, et garde les demandes de clients", async () => {
    lireSubmissions.mockResolvedValue([
      {
        id: "a",
        type: "contact",
        details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
        contactEmail: "candidat@example.com",
      },
      {
        id: "b",
        type: "contact",
        details: { unifiedType: "simulateur_roi" },
        contactEmail: "dirigeante@example.com",
      },
      { id: "c", type: "quote_request", details: null, contactEmail: "achats@example.com" },
    ]);

    const s = await chargerTunnelVente(30);
    expect(s.demandes).toBe(2);
    expect(s.demandesAvecEmail).toBe(2);
    // Le candidat ne doit même pas être cherché parmi les clients.
    const { where } = lireClients.mock.calls[0]?.[0] as {
      where: { contactEmail: { in: string[] } };
    };
    expect(where.contactEmail.in).not.toContain("candidat@example.com");
  });

  it("une fenêtre qui ne contient QUE des candidats apporteurs rend la synthèse vide", async () => {
    lireSubmissions.mockResolvedValue([
      {
        id: "a",
        type: "contact",
        details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
        contactEmail: "candidat@example.com",
      },
    ]);
    const s = await chargerTunnelVente(30);
    expect(s.demandes).toBe(0);
    expect(s.parOrigine).toEqual([]);
  });
});
