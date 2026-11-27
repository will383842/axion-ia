import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  commission: null as Record<string, unknown> | null,
  parrainId: null as string | null,
  signeeAt: new Date("2026-12-01T00:00:00Z") as Date | null,
  // Version signée par l'apporteur de la présentation (décision du 27/11 : elle choisit la grille).
  version: "2.8" as unknown,
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
    factureFormation: {
      findUnique: vi.fn(async () => ({ emiseAt: etat.signeeAt, devis: null })),
    },
    presentationEntreprise: {
      findUnique: vi.fn(async () => ({
        recueAt: new Date("2026-10-20T00:00:00Z"),
        apporteur: { signatureApporteur: { version: etat.version } },
      })),
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
  presentationId: "P1",
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
  etat.signeeAt = new Date("2026-12-01T00:00:00Z");
  etat.version = "2.8";
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
  it("site web : 15 % du HT facturé (A1.5 du contrat 2.8), la ligne devient due", async () => {
    const r = await classerActiviteCommission("C1", "site_web");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({
      activite: "site_web",
      montantCents: 30_000,
      statut: "due",
    });
  });
  it("site web signé AVANT la date d'effet : ligne close à 0 €, part du parrain close aussi", async () => {
    etat.signeeAt = new Date("2026-10-15T00:00:00Z");
    etat.parrainId = "PAR1";
    const r = await classerActiviteCommission("C1", "site_web");
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/antérieure au contrat 2\.8/);
    expect(r.message).not.toMatch(/ce type de prestation/);
    expect(etat.maj[0]!.data).toMatchObject({ montantCents: 0, statut: "versee" });
    expect(etat.maj[1]!.where).toMatchObject({ apporteurId: "PAR1", parrainage: true });
  });
  it("coaching (un_a_un) : aucune commission, ligne close à 0 € (jamais due)", async () => {
    const r = await classerActiviteCommission("C1", "un_a_un");
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/ce type de prestation/);
    expect(etat.maj[0]!.data).toMatchObject({ montantCents: 0, statut: "versee" });
  });
  it("classement manuel en conférence : aucune commission, ligne close à 0 €, part du parrain close", async () => {
    etat.commission = { ...ligne, factureHtCents: 210_000 };
    etat.parrainId = "PAR1";
    const r = await classerActiviteCommission("C1", "conference");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({ montantCents: 0, statut: "versee" });
    expect(etat.maj[1]!.where).toMatchObject({ apporteurId: "PAR1", parrainage: true });
  });
  it("classement manuel en conférence signée AVANT le 26/11/2026 : forfait de l'ancien contrat (500 €)", async () => {
    etat.signeeAt = new Date("2026-11-20T00:00:00Z");
    etat.commission = { ...ligne, factureHtCents: 210_000 };
    const r = await classerActiviteCommission("C1", "conference");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({ montantCents: 50_000 });
  });
  it("palier « conférence » d'une commande signée AVANT le 26/11/2026 : 500 € ; APRÈS : refus", async () => {
    etat.signeeAt = new Date("2026-11-20T00:00:00Z");
    etat.commission = { ...ligne, activite: "conference", factureHtCents: 210_000 };
    const avant = await qualifierCommission("C1", "conference", 1);
    expect(avant).toEqual({ ok: true, montantCents: 50_000 });
    etat.maj.length = 0;
    etat.signeeAt = new Date("2026-12-01T00:00:00Z");
    const apres = await qualifierCommission("C1", "conference", 1);
    expect(apres.ok).toBe(false);
    expect(etat.maj).toHaveLength(0);
  });
  it("facture typée formation : le palier « Conférence » ne se qualifie plus (aucune commission)", async () => {
    etat.commission = { ...ligne, activite: "formation", factureHtCents: 100_000 };
    const r = await qualifierCommission("C1", "conference", 1);
    expect(r.ok).toBe(false);
    expect(etat.maj).toHaveLength(0);
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

describe("Journée IA « à qualifier » : réglée à 500 € par journée au prorata (A1.1)", () => {
  it("activité inconnue, 2 journées payées 2 980 € : 1 000 €, prix public 2 980 € enregistré", async () => {
    etat.commission = { ...ligne, factureHtCents: 298_000 };
    const r = await qualifierCommission("C1", "journee-ia", 2);
    expect(r).toEqual({ ok: true, montantCents: 100_000 });
    expect(etat.maj[0]!.data).toMatchObject({
      palier: "journee-ia",
      prixPublicHtCents: 298_000,
      montantCents: 100_000,
      statut: "due",
    });
  });
  it("audit, 1 journée remisée à 1 341 € : 450 €", async () => {
    etat.commission = { ...ligne, activite: "audit", factureHtCents: 134_100 };
    expect(await qualifierCommission("C1", "journee-ia", 1)).toEqual({
      ok: true,
      montantCents: 45_000,
    });
  });
  it("facture de coaching : la décision humaine reste possible (500 € par journée)", async () => {
    etat.commission = { ...ligne, activite: "un_a_un", factureHtCents: 149_000 };
    expect(await qualifierCommission("C1", "journee-ia", 1)).toEqual({
      ok: true,
      montantCents: 50_000,
    });
  });
});

describe("décision du 27/11 : la grille du contrat SIGNÉ (signataire 2.6 sans avenant)", () => {
  beforeEach(() => {
    etat.version = "2.6";
  });
  it("coaching 1 390 € HT : 417 € (30 %, annexe 1 de la 2.6), la ligne devient due", async () => {
    etat.commission = { ...ligne, factureHtCents: 139_000 };
    const r = await classerActiviteCommission("C1", "un_a_un");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({
      activite: "un_a_un",
      montantCents: 41_700,
      statut: "due",
    });
  });
  it("conférence signée après le 26/11 : 500 €", async () => {
    etat.commission = { ...ligne, factureHtCents: 240_000 };
    const r = await classerActiviteCommission("C1", "conference");
    expect(r.ok).toBe(true);
    expect(etat.maj[0]!.data).toMatchObject({ montantCents: 50_000, statut: "due" });
    etat.maj.length = 0;
    etat.commission = { ...ligne, activite: "conference", factureHtCents: 240_000 };
    expect(await qualifierCommission("C1", "conference", 1)).toEqual({
      ok: true,
      montantCents: 50_000,
    });
  });
  it("développement web : aucune commission (A1.5 de la 2.6), ligne close à 0 €", async () => {
    const r = await classerActiviteCommission("C1", "site_web");
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/ce type de prestation/);
    expect(etat.maj[0]!.data).toMatchObject({ montantCents: 0, statut: "versee" });
  });
  it("formation 5 jours générale 9 500 € : 1 000 € (plafond du 27/11) ; 3 jours à 4 560 € : 800 €", async () => {
    etat.commission = { ...ligne, activite: "formation", factureHtCents: 950_000 };
    expect(await qualifierCommission("C1", "formation-generale-3j-plus", 5)).toEqual({
      ok: true,
      montantCents: 100_000,
    });
    etat.commission = { ...ligne, activite: "formation", factureHtCents: 456_000 };
    expect(await qualifierCommission("C1", "formation-generale-3j-plus", 3)).toEqual({
      ok: true,
      montantCents: 80_000,
    });
  });
  it("palier 3 jours ou plus avec 2 journées : refus explicite, rien n'est écrit", async () => {
    etat.commission = { ...ligne, activite: "formation", factureHtCents: 380_000 };
    const r = await qualifierCommission("C1", "formation-generale-3j-plus", 2);
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/3 au moins/) });
    expect(etat.maj).toHaveLength(0);
  });
});

describe("version signée inconnue : ESCALADE, jamais 0 € silencieux", () => {
  it.each([["2.7"], ["2.2"], [undefined]])(
    "version %j : classer et qualifier refusent",
    async (v) => {
      etat.version = v;
      const r = await classerActiviteCommission("C1", "un_a_un");
      expect(r).toMatchObject({
        ok: false,
        message: expect.stringMatching(/Version du contrat signé inconnue/),
      });
      etat.commission = { ...ligne, activite: "formation", factureHtCents: 190_000 };
      const q = await qualifierCommission("C1", "formation-generale-1j", 1);
      expect(q).toMatchObject({ ok: false, message: expect.stringMatching(/inconnue/) });
      expect(etat.maj).toHaveLength(0);
    },
  );
});
