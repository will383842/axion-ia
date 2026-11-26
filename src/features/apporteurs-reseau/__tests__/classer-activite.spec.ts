import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  commission: null as Record<string, unknown> | null,
  part: null as Record<string, unknown> | null,
  facture: null as Record<string, unknown> | null,
  factures: [] as Array<Record<string, unknown>>,
  parrainId: null as string | null,
  maj: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
        a.where.factureId_apporteurId_parrainage ? etat.part : etat.commission,
      ),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          etat.maj.push(a);
          return { count: 1 };
        },
      ),
      aggregate: vi.fn(async () => ({ _sum: { montantCents: 0 } })),
    },
    factureFormation: {
      findUnique: vi.fn(async () => etat.facture),
      findMany: vi.fn(async () => etat.factures),
    },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    apporteurReseau: {
      findUnique: vi.fn(async () => ({ parrainId: etat.parrainId })),
    },
    emailLog: { count: vi.fn(async () => 1) },
  },
}));

import { classerActiviteCommission, qualifierCommission } from "../commissions";
import { montantEnCentimes } from "../resiliation";

const ligne = {
  id: "C1",
  apporteurId: "APP1",
  factureId: "F1",
  parrainage: false,
  activite: "inconnue",
  factureHtCents: 200_000,
  statut: "a_qualifier",
};

beforeEach(() => {
  etat.commission = { ...ligne };
  etat.part = null;
  etat.facture = null;
  etat.factures = [];
  etat.parrainId = null;
  etat.maj = [];
});

describe("ligne « à qualifier » d'une activité inconnue : qualifiable ou classée « aucune »", () => {
  it("audit : commission de 30 % du HT facturé, la ligne devient due", async () => {
    const r = await classerActiviteCommission("C1", "audit");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({
      activite: "audit",
      montantCents: 60_000,
      statut: "due",
    });
  });
  it("intégration : 15 % du HT facturé", async () => {
    await classerActiviteCommission("C1", "implementation");
    expect(etat.maj[0]!.data).toMatchObject({ montantCents: 30_000 });
  });
  it("site web : 15 % du HT facturé (contrat 2.8, annexe 1, A1.5)", async () => {
    const r = await classerActiviteCommission("C1", "site_web");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({ activite: "site_web", montantCents: 30_000 });
  });
  it("Journée IA non reconnue, classée à la main : 500 € au prorata de 1 490 €", async () => {
    etat.commission = { ...ligne, factureHtCents: 149_000 };
    const r = await classerActiviteCommission("C1", "journee_ia");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({
      activite: "journee_ia",
      palier: "journee-ia",
      montantCents: 50_000,
      statut: "due",
    });
  });
  it("conférence (A1.6) : aucune commission, ligne ANNULÉE, jamais close à 0 €", async () => {
    const r = await classerActiviteCommission("C1", "conference");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toEqual({
      activite: "conference",
      palier: "aucune-commission",
      statut: "annulee",
    });
  });
  it("coaching avec un parrain : la part du parrain est annulée aussi, jamais à 0 €", async () => {
    etat.parrainId = "PAR1";
    await classerActiviteCommission("C1", "un_a_un");
    expect(etat.maj[1]!.where).toMatchObject({ apporteurId: "PAR1", parrainage: true });
    expect(etat.maj[1]!.data).toEqual({ statut: "annulee", palier: "aucune-commission" });
    expect(etat.maj.some((m) => "montantCents" in m.data)).toBe(false);
  });
  it("facture typée formation, palier « Conférence » : la ligne est annulée (A1.6)", async () => {
    etat.commission = { ...ligne, activite: "formation", factureHtCents: 100_000 };
    const r = await qualifierCommission("C1", "conference", 1);
    expect(r).toEqual({ ok: true, montantCents: 0 });
    expect(etat.maj[0]!.data).toEqual({
      activite: "conference",
      palier: "conference",
      statut: "annulee",
    });
  });
  it("formation : l'activité est posée, le palier se choisit ensuite", async () => {
    const r = await classerActiviteCommission("C1", "formation");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toEqual({ activite: "formation" });
  });
  it("refuse une activité inconnue, une ligne déjà qualifiée ou une formation", async () => {
    expect((await classerActiviteCommission("C1", "magie")).ok).toBe(false);
    etat.commission = { ...ligne, statut: "due" };
    expect((await classerActiviteCommission("C1", "audit")).ok).toBe(false);
    etat.commission = { ...ligne, activite: "formation" };
    expect((await classerActiviteCommission("C1", "audit")).ok).toBe(false);
    expect(etat.maj).toEqual([]);
  });
});

// Relecture du lot « grille » : le classement manuel « Journée IA » compte les journées et écrit le
// prix public (l'avoir recalcule juste) ; une commande mixte garde la commission de chaque partie.
describe("classement manuel « Journée IA » : quantité, prix public, commande mixte", () => {
  const l = (designation: string, prix: number, quantite = 1) => ({
    designation,
    quantite,
    prixUnitaireHtCents: prix,
  });
  const commande = (activite: string | null, lignes: unknown[], total: number) => {
    etat.facture = {
      id: "F1",
      devisId: "D1",
      activite,
      montantHtCents: total,
      lignes,
      devis: { montantTotalHtCents: total },
    };
    etat.factures = [{ id: "F1", activite, montantHtCents: total, lignes }];
  };

  it("2 journées à 1 490 € classées à la main : 1 000 €, prix public 2 980 €", async () => {
    etat.commission = { ...ligne, factureHtCents: 298_000 };
    commande("audit", [l("Journée IA", 149_000, 2)], 298_000);
    const r = await classerActiviteCommission("C1", "journee_ia");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({
      activite: "journee_ia",
      palier: "journee-ia",
      prixPublicHtCents: 298_000,
      montantCents: 100_000,
    });
  });

  it("commande mixte (Journée IA + audit) classée « Journée IA » : 500 + 870 €", async () => {
    etat.commission = { ...ligne, factureHtCents: 439_000 };
    commande("audit", [l("Journée IA", 149_000), l("Audit", 290_000)], 439_000);
    const r = await classerActiviteCommission("C1", "journee_ia");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({
      activite: "journee_ia",
      palier: "mixte:1x149000+audit:290000",
      prixPublicHtCents: 149_000,
      montantCents: 137_000,
    });
  });

  it("commande mixte dont l'autre partie n'a pas d'activité : refus, rien n'est écrit", async () => {
    etat.commission = { ...ligne, factureHtCents: 249_000 };
    commande(null, [l("Journée IA", 149_000), l("Prestation", 100_000)], 249_000);
    const r = await classerActiviteCommission("C1", "journee_ia");
    expect(r.ok).toBe(false);
    expect(etat.maj).toEqual([]);
  });

  it("Journée IA 1 000 + formation 1 900, palier choisi : 335,57 + 500 €", async () => {
    etat.commission = {
      ...ligne,
      activite: "formation",
      palier: "mixte:1x100000+formation:190000",
      factureHtCents: 290_000,
    };
    const r = await qualifierCommission("C1", "formation-generale-1j", 1);
    expect(r).toEqual({ ok: true, montantCents: 83_557 });
    expect(etat.maj[0]!.data).toMatchObject({
      activite: "journee_ia",
      palier: "mixte:1x100000+formation-generale-1j:190000",
      prixPublicHtCents: 339_000,
      montantCents: 83_557,
    });
  });
});

describe("part du parrain d'une ligne qualifiée : arrondi au plus proche, jamais 0,00 €", () => {
  it("10 % de 500,05 € = 50,01 € (arrondi au plus proche, art. 4.6)", async () => {
    etat.parrainId = "PAR1";
    etat.part = { id: "PP", statut: "a_qualifier", apporteurId: "PAR1" };
    etat.commission = { ...ligne, factureHtCents: 333_367 };
    await classerActiviteCommission("C1", "implementation");
    expect(etat.maj[0]!.data).toMatchObject({ montantCents: 50_005 });
    expect(etat.maj[1]!.where).toMatchObject({ id: "PP" });
    expect(etat.maj[1]!.data).toMatchObject({ montantCents: 5_001 });
  });

  it("part arrondie à 0 € : ANNULÉE, jamais une ligne à 0,00 €", async () => {
    etat.parrainId = "PAR1";
    etat.part = { id: "PP", statut: "a_qualifier", apporteurId: "PAR1" };
    etat.commission = { ...ligne, factureHtCents: 13 };
    await classerActiviteCommission("C1", "audit");
    expect(etat.maj[0]!.data).toMatchObject({ montantCents: 4 });
    expect(etat.maj[1]!.where).toMatchObject({ id: "PP" });
    expect(etat.maj[1]!.data).toEqual({ statut: "annulee", palier: "aucune-commission" });
    expect(etat.maj.some((m) => m.data.montantCents === 0)).toBe(false);
  });
});

describe("saisie d'un montant en euros", () => {
  it("accepte virgule, point et espaces", () => {
    expect(montantEnCentimes("150,50")).toBe(15_050);
    expect(montantEnCentimes("150.5")).toBe(15_050);
    expect(montantEnCentimes(" 1 200 ")).toBe(120_000);
  });
  it("refuse le texte, le négatif et plus de deux décimales", () => {
    expect(montantEnCentimes("abc")).toBeNull();
    expect(montantEnCentimes("-5")).toBeNull();
    expect(montantEnCentimes("1,234")).toBeNull();
    expect(montantEnCentimes("")).toBeNull();
  });
});
