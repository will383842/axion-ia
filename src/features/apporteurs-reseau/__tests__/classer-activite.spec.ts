import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  commission: null as Record<string, unknown> | null,
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
      findUnique: vi.fn(async () => etat.commission),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          etat.maj.push(a);
          return { count: 1 };
        },
      ),
      aggregate: vi.fn(async () => ({ _sum: { montantCents: 0 } })),
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
