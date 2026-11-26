/**
 * Avoir du Hub sur une facture commissionnée : confirmation explicite exigée.
 * Un avoir reprend la commission d'apporteur au prorata ; un bon d'achat offert ne doit
 * jamais être émis comme avoir du Hub.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFactureFindUnique = vi.fn();
const mockFactureFindMany = vi.fn();
const mockCommissionCount = vi.fn();
const mockGenererAvoir = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    factureFormation: {
      findUnique: (...a: unknown[]) => mockFactureFindUnique(...a),
      findMany: (...a: unknown[]) => mockFactureFindMany(...a),
    },
    commissionApporteur: { count: (...a: unknown[]) => mockCommissionCount(...a) },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "a", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "a", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/financements/facture-libre", () => ({
  genererFactureLibre: vi.fn(),
  genererAvoirFacture: (...a: unknown[]) => mockGenererAvoir(...a),
  enregistrerPaiementFacture: vi.fn(),
}));
vi.mock("@/server/qualiopi/financements/dossier-financement", () => ({
  transitionnerDossier: vi.fn(),
  creerDossierDepuisSession: vi.fn(),
}));

import { genererAvoirAction } from "./facturation-hub";

const FACTURE_ID = "11111111-1111-4111-8111-111111111111";
const SOEUR_ID = "22222222-2222-4222-8222-222222222222";
const DEVIS_ID = "33333333-3333-4333-8333-333333333333";
const base = { factureId: FACTURE_ID, motif: "Remboursement du client" };

beforeEach(() => {
  vi.clearAllMocks();
  mockFactureFindUnique.mockResolvedValue({ id: FACTURE_ID, devisId: DEVIS_ID });
  mockFactureFindMany.mockResolvedValue([{ id: FACTURE_ID }, { id: SOEUR_ID }]);
  mockCommissionCount.mockResolvedValue(0);
  mockGenererAvoir.mockResolvedValue({ avoirId: "av-1", numero: "AXI-AVO-2026-001" });
});

describe("genererAvoirAction — facture commissionnée", () => {
  it("refuse sans confirmation quand la facture porte une commission", async () => {
    mockCommissionCount.mockResolvedValue(1);
    const r = await genererAvoirAction(base);
    expect(r).toEqual({ error: expect.stringContaining("porte une commission d'apporteur") });
    expect(mockGenererAvoir).not.toHaveBeenCalled();
  });

  it("émet l'avoir avec la confirmation", async () => {
    mockCommissionCount.mockResolvedValue(1);
    const r = await genererAvoirAction({ ...base, confirmerReprise: true });
    expect(r).toEqual({ data: { avoirId: "av-1", numero: "AXI-AVO-2026-001" } });
    expect(mockGenererAvoir).toHaveBeenCalledTimes(1);
  });

  it("inchangé sans commission", async () => {
    const r = await genererAvoirAction(base);
    expect("data" in r).toBe(true);
    expect(mockGenererAvoir).toHaveBeenCalledTimes(1);
  });

  it("une commission annulée n'avertit pas (filtre statut ≠ annulee)", async () => {
    await genererAvoirAction(base);
    expect(mockCommissionCount.mock.calls[0]?.[0]).toMatchObject({
      where: { statut: { not: "annulee" } },
    });
    expect(mockGenererAvoir).toHaveBeenCalledTimes(1);
  });

  it("une facture sœur du même devis commissionnée refuse", async () => {
    mockCommissionCount.mockImplementation(
      async (arg: { where: { factureId: { in: string[] } } }) =>
        arg.where.factureId.in.includes(SOEUR_ID) ? 1 : 0,
    );
    const r = await genererAvoirAction(base);
    expect("error" in r).toBe(true);
    expect(mockGenererAvoir).not.toHaveBeenCalled();
  });
});
