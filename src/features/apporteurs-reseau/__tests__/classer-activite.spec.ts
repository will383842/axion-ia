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
  it("site web : aucune commission, ligne close à 0 € (jamais due)", async () => {
    const r = await classerActiviteCommission("C1", "site_web");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({
      montantCents: 0,
      statut: "versee",
      palier: "aucune-commission",
    });
  });
  it("site web avec un parrain : la part du parrain est close à 0 € aussi", async () => {
    etat.parrainId = "PAR1";
    await classerActiviteCommission("C1", "site_web");
    expect(etat.maj[1]!.where).toMatchObject({ apporteurId: "PAR1", parrainage: true });
    expect(etat.maj[1]!.data).toMatchObject({ montantCents: 0 });
  });
  it("classement manuel d'une ligne à qualifier en conférence : 500 € fixes, due", async () => {
    etat.commission = { ...ligne, factureHtCents: 210_000 };
    const r = await classerActiviteCommission("C1", "conference");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({
      activite: "conference",
      palier: "conference",
      montantCents: 50_000,
      statut: "due",
    });
  });
  it("conférence : la part du parrain suit (10 % de 500 € = 50 €)", async () => {
    etat.parrainId = "PAR1";
    await classerActiviteCommission("C1", "conference");
    expect(etat.maj[0]!.data).toMatchObject({ montantCents: 50_000 });
  });
  it("facture typée formation : le palier « Conférence » de la qualification pose 500 €", async () => {
    etat.commission = { ...ligne, activite: "formation", factureHtCents: 100_000 };
    const r = await qualifierCommission("C1", "conference", 1);
    expect(r).toEqual({ ok: true, montantCents: 50_000 });
    expect(etat.maj[0]!.data).toMatchObject({
      activite: "conference",
      palier: "conference",
      montantCents: 50_000,
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
