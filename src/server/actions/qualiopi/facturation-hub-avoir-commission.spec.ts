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
const mockLogActivity = vi.fn();
const mockPresentations = vi.fn();
const mockPresentationPour = vi.fn();

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
  logQualiopiActivity: (...a: unknown[]) => mockLogActivity(...a),
}));
vi.mock("@/features/apporteurs-reseau/passage-quotidien", () => ({
  dateDeCommande: (f: { devis: { acceptedAt: Date | null } | null; emiseAt: Date | null }) =>
    f.devis?.acceptedAt ?? f.emiseAt ?? null,
  lirePresentationsProtegees: (...a: unknown[]) => mockPresentations(...a),
  presentationPourEtablissement: (...a: unknown[]) => mockPresentationPour(...a),
}));
vi.mock("@/features/apporteurs-reseau/etablissement-presentation", () => ({
  lireEtablissements: async () => new Map(),
  lireSiretsDevis: async () => new Map(),
  siretDeLaCommande: () => null,
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
  mockLogActivity.mockResolvedValue(undefined);
  mockPresentations.mockResolvedValue([]);
  mockPresentationPour.mockReturnValue(null);
  mockFactureFindUnique.mockResolvedValue({
    id: FACTURE_ID,
    devisId: DEVIS_ID,
    emiseAt: new Date("2026-05-01"),
    devis: { acceptedAt: new Date("2026-04-20") },
    client: { siren: "123456789", siret: null },
  });
  mockFactureFindMany.mockResolvedValue([{ id: FACTURE_ID }, { id: SOEUR_ID }]);
  mockCommissionCount.mockResolvedValue(0);
  mockGenererAvoir.mockResolvedValue({ avoirId: "av-1", numero: "AXI-AVO-2026-001" });
});

describe("genererAvoirAction — facture commissionnée", () => {
  it("refuse sans confirmation quand la facture porte une commission", async () => {
    mockCommissionCount.mockResolvedValue(1);
    const r = await genererAvoirAction(base);
    expect(r).toMatchObject({
      error: expect.stringContaining("porte ou portera une commission d'apporteur"),
    });
    expect(mockGenererAvoir).not.toHaveBeenCalled();
  });

  it("émet l'avoir avec la confirmation", async () => {
    mockCommissionCount.mockResolvedValue(1);
    const r = await genererAvoirAction({ ...base, confirmerReprise: true });
    expect(r).toEqual({ data: { avoirId: "av-1", numero: "AXI-AVO-2026-001" } });
    expect(mockGenererAvoir).toHaveBeenCalledTimes(1);
  });

  it("geste commercial (bon d'achat offert) : émis SANS confirmation de reprise, la pièce porte le marqueur", async () => {
    mockCommissionCount.mockResolvedValue(1);
    const r = await genererAvoirAction({ ...base, gesteCommercial: true });
    expect("data" in r).toBe(true);
    expect(mockGenererAvoir).toHaveBeenCalledWith(
      expect.objectContaining({ factureId: FACTURE_ID, gesteCommercial: true }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({ changes: expect.objectContaining({ gesteCommercial: true }) }),
    );
  });

  it("avoir normal : aucun marqueur n'est posé", async () => {
    mockCommissionCount.mockResolvedValue(1);
    await genererAvoirAction({ ...base, confirmerReprise: true });
    expect(mockGenererAvoir.mock.calls[0]?.[0]).not.toHaveProperty("gesteCommercial");
  });

  it("geste commercial ET confirmation de reprise ensemble : refusé", async () => {
    mockCommissionCount.mockResolvedValue(1);
    const r = await genererAvoirAction({ ...base, gesteCommercial: true, confirmerReprise: true });
    expect("error" in r).toBe(true);
    expect(mockGenererAvoir).not.toHaveBeenCalled();
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

  it("refuse sans confirmation, avec le code confirmationRequise", async () => {
    mockCommissionCount.mockResolvedValue(1);
    const r = await genererAvoirAction(base);
    expect(r).toMatchObject({ confirmationRequise: true });
  });

  it("aucune ligne de commission mais présentation couvrante : refuse sans confirmation", async () => {
    mockPresentations.mockResolvedValue([{ id: "p1", siren: "123456789" }]);
    mockPresentationPour.mockReturnValue({ presentation: { id: "p1" } });
    const r = await genererAvoirAction(base);
    expect(r).toEqual({
      error: expect.stringContaining("porte ou portera une commission d'apporteur"),
      confirmationRequise: true,
    });
    expect(mockGenererAvoir).not.toHaveBeenCalled();
  });

  it("présentation couvrante mais confirmée : l'avoir est émis", async () => {
    mockPresentations.mockResolvedValue([{ id: "p1", siren: "123456789" }]);
    mockPresentationPour.mockReturnValue({ presentation: { id: "p1" } });
    const r = await genererAvoirAction({ ...base, confirmerReprise: true });
    expect("data" in r).toBe(true);
  });

  it("présentation d'un autre SIREN : pas d'avertissement", async () => {
    mockPresentations.mockResolvedValue([{ id: "p2", siren: "999999999" }]);
    mockPresentationPour.mockReturnValue({ presentation: { id: "p2" } });
    const r = await genererAvoirAction(base);
    expect("data" in r).toBe(true);
    expect(mockPresentationPour).not.toHaveBeenCalled();
  });

  it("à attribuer compte comme commissionnée", async () => {
    mockPresentations.mockResolvedValue([{ id: "p1", siren: "123456789" }]);
    mockPresentationPour.mockReturnValue({ aAttribuer: true, candidats: [] });
    const r = await genererAvoirAction(base);
    expect("error" in r).toBe(true);
  });

  it("le journal enregistre confirmerReprise", async () => {
    mockCommissionCount.mockResolvedValue(1);
    await genererAvoirAction({ ...base, confirmerReprise: true });
    expect(mockLogActivity.mock.calls[0]?.[0]).toMatchObject({
      action: "facturation.avoir.emettre",
      changes: { confirmerReprise: true },
    });
  });

  it("le journal enregistre confirmerReprise: false sans confirmation", async () => {
    await genererAvoirAction(base);
    expect(mockLogActivity.mock.calls[0]?.[0]).toMatchObject({
      changes: { confirmerReprise: false },
    });
  });

  it("facture sans devis : aucune lecture des factures sœurs", async () => {
    mockFactureFindUnique.mockResolvedValue({
      id: FACTURE_ID,
      devisId: null,
      emiseAt: new Date("2026-05-01"),
      devis: null,
      client: { siren: "123456789", siret: null },
    });
    mockCommissionCount.mockResolvedValue(1);
    const r = await genererAvoirAction(base);
    expect("error" in r).toBe(true);
    expect(mockFactureFindMany).not.toHaveBeenCalled();
    expect(mockCommissionCount.mock.calls[0]?.[0]).toMatchObject({
      where: { factureId: { in: [FACTURE_ID] } },
    });
  });

  it("les sœurs lues excluent les avoirs (avoirDeId: null)", async () => {
    await genererAvoirAction(base);
    expect(mockFactureFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { devisId: DEVIS_ID, avoirDeId: null },
    });
  });

  it("avoir partiel sur facture commissionnée : refuse aussi", async () => {
    mockCommissionCount.mockResolvedValue(1);
    const r = await genererAvoirAction({ ...base, montantPartielHtCents: 5000 });
    expect("error" in r).toBe(true);
    expect(mockGenererAvoir).not.toHaveBeenCalled();
  });

  it("facture introuvable : pas d'avertissement, l'erreur vient de la génération", async () => {
    mockFactureFindUnique.mockResolvedValue(null);
    mockGenererAvoir.mockRejectedValue(new Error("Facture introuvable."));
    const r = await genererAvoirAction(base);
    expect(r).toEqual({ error: "Facture introuvable." });
  });
});
