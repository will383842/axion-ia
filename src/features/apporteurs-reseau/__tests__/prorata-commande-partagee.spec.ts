import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrat 2.7, art. 3.6 (décision de Will du 09/10) : une commande qui profite aussi à d'autres
// établissements est commissionnée au prorata des participants de l'établissement attribué,
// arrondie au centime supérieur. Exemple : 4 participants de Grenoble sur 10 → 4/10.

const etat = vi.hoisted(() => ({
  ligne: null as Record<string, unknown> | null,
  parrain: null as Record<string, unknown> | null,
  prorata: null as Record<string, unknown> | null,
  traces: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      findUnique: vi.fn(async () => (etat.ligne ? { ...etat.ligne } : null)),
      findMany: vi.fn(async () => (etat.parrain ? [{ ...etat.parrain }] : [])),
      updateMany: vi.fn(
        async (a: {
          where: { id: string; montantCents: number | null };
          data: Record<string, unknown>;
        }) => {
          const cible = a.where.id === etat.ligne?.id ? etat.ligne : etat.parrain;
          if (!cible || cible.montantCents !== a.where.montantCents) return { count: 0 };
          Object.assign(cible, a.data);
          return { count: 1 };
        },
      ),
    },
    commissionProrata: {
      findUnique: vi.fn(async () => (etat.prorata ? { ...etat.prorata } : null)),
      findMany: vi.fn(async () => (etat.prorata ? [{ ...etat.prorata }] : [])),
      upsert: vi.fn(async (a: { create: Record<string, unknown> }) => {
        etat.prorata = { ...a.create };
        return {};
      }),
    },
    activityLog: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.traces.push(a.data);
        return {};
      }),
    },
  },
}));

import { construireDonneesAutofacture } from "../autofacture-donnees";
import {
  appliquerProrata,
  fixerProrata,
  libelleProrata,
  lireProratas,
  validerProrata,
} from "../prorata";
import { TEXTES_DECLARATION } from "../../../app/apporteur/dossier/[id]/[jeton]/textes-declaration";

const p = (e: number, t: number) => ({ participantsEtablissement: e, participantsCommande: t });

beforeEach(() => {
  etat.ligne = {
    id: "C1",
    statut: "due",
    parrainage: false,
    montantCents: 30_000,
    autofactureNumero: null,
    factureId: "F1",
  };
  etat.parrain = {
    id: "P1",
    statut: "due",
    montantCents: 3_000,
    autofactureNumero: null,
  };
  etat.prorata = null;
  etat.traces = [];
});

describe("calcul (pur)", () => {
  it("4 participants sur 10 → 4/10 de la commission", () => {
    expect(appliquerProrata(30_000, p(4, 10))).toBe(12_000);
  });

  it("arrondi au centime SUPÉRIEUR, en faveur de l'apporteur", () => {
    expect(appliquerProrata(10_000, p(1, 3))).toBe(3_334); // 3 333,33… → 3 334
    expect(appliquerProrata(50_000, p(2, 3))).toBe(33_334); // 33 333,33… → 33 334
    expect(appliquerProrata(9_999, p(1, 1))).toBe(9_999);
  });

  it("vide, ou tous les participants de l'établissement = commande entière", () => {
    expect(appliquerProrata(30_000, null)).toBe(30_000);
    expect(appliquerProrata(30_000, p(10, 10))).toBe(30_000);
    expect(libelleProrata(p(10, 10))).toBeNull();
    expect(libelleProrata(null)).toBeNull();
    expect(libelleProrata(p(4, 10))).toBe("4/10 des participants");
  });

  it("nombres incohérents refusés", () => {
    expect(validerProrata(p(0, 10))).not.toBeNull();
    expect(validerProrata(p(11, 10))).not.toBeNull();
    expect(validerProrata(p(1.5, 10))).not.toBeNull();
    expect(validerProrata(p(Number.NaN, 10))).not.toBeNull();
    expect(validerProrata(p(4, 10))).toBeNull();
  });
});

describe("console : fixer le prorata d'une commission pas encore facturée", () => {
  it("la commission devient 4/10, la part du parrain suit (10 %), la commission entière est gardée", async () => {
    const r = await fixerProrata("C1", p(4, 10), "admin-1");
    expect(r).toMatchObject({ ok: true, montantCents: 12_000 });
    expect(etat.ligne!.montantCents).toBe(12_000);
    expect(etat.parrain!.montantCents).toBe(1_200);
    expect(etat.prorata).toMatchObject({
      participantsEtablissement: 4,
      participantsCommande: 10,
      montantAvantCents: 30_000,
    });
    expect(etat.traces[0]).toMatchObject({ action: "commission_apporteur.reduite" });
  });

  it("corriger 4/10 en 5/10 repart de la commande entière (pas de double réduction) ; 10/10 la rend", async () => {
    await fixerProrata("C1", p(4, 10));
    expect((await fixerProrata("C1", p(5, 10))).ok).toBe(true);
    expect(etat.ligne!.montantCents).toBe(15_000);
    expect(etat.parrain!.montantCents).toBe(1_500);
    await fixerProrata("C1", p(10, 10));
    expect(etat.ligne!.montantCents).toBe(30_000);
  });

  it("refusé sur une ligne déjà facturée, une part de parrainage, ou un montant pas arrêté", async () => {
    etat.ligne!.autofactureNumero = "AXI-APP-2026-0001";
    expect((await fixerProrata("C1", p(4, 10))).ok).toBe(false);
    etat.ligne!.autofactureNumero = null;
    etat.ligne!.parrainage = true;
    expect((await fixerProrata("C1", p(4, 10))).ok).toBe(false);
    etat.ligne!.parrainage = false;
    etat.ligne!.montantCents = null;
    expect((await fixerProrata("C1", p(4, 10))).ok).toBe(false);
  });

  it("part du parrain déjà facturée : non modifiée, avertissement", async () => {
    etat.parrain!.autofactureNumero = "AXI-APP-2026-0002";
    const r = await fixerProrata("C1", p(4, 10));
    expect(r.ok && r.avertissement).toContain("déjà facturée");
    expect(etat.parrain!.montantCents).toBe(3_000);
  });

  it("lecture : la table absente (fenêtre app/worker) rend une commande entière", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.commissionProrata.findMany).mockRejectedValueOnce({ code: "P2021" });
    expect((await lireProratas(["C1"])).size).toBe(0);
  });
});

describe("le prorata se lit sur l'autofacture et dans l'espace de l'apporteur", () => {
  it("autofacture : « commande partagée : 4/10 des participants (art. 3.6) »", () => {
    const r = construireDonneesAutofacture({
      numero: "AXI-APP-2026-0042",
      periodeLibelle: "commissions exigibles au 20 octobre 2026",
      dateEmission: new Date("2026-10-20T10:00:00Z"),
      apporteur: {
        nom: "Jeanne Martin",
        denomination: null,
        siren: "123456789",
        adresse: "1 rue des Lilas, 69000 Lyon",
        regimeTva: "franchise_293b",
        numeroTva: null,
        email: null,
      },
      commissions: [
        {
          id: "C1",
          activite: "audit",
          palier: null,
          parrainage: false,
          montantCents: 12_000,
          factureHtCents: 100_000,
          prorata: p(4, 10),
        },
      ],
      organisme: { raisonSociale: "Axion IA" } as never,
      totalAttenduCents: 12_000,
    });
    expect(r.ok && r.data.lignes[0]!.designation).toContain(
      "commande partagée : 4/10 des participants (art. 3.6)",
    );
  });

  it("espace de l'apporteur : la phrase vouvoie et cite l'article", () => {
    expect(TEXTES_DECLARATION.prorata("4/10 des participants")).toBe(
      "Commande partagée avec d'autres établissements : commission calculée sur 4/10 des participants (article 3.6 du contrat).",
    );
  });
});
