import { beforeEach, describe, expect, it, vi } from "vitest";

// PR L (point 20) : contrôle périodique du registre public pour les apporteurs sous contrat.

type Ligne = {
  apporteurId: string;
  dernierControleAt: Date;
  etat: string;
  etatDepuis: Date;
  consecutifs: number;
  alerteeAt: Date | null;
};

const etat = vi.hoisted(() => ({
  apporteurs: [] as Array<Record<string, unknown>>,
  lignes: new Map<string, Record<string, unknown>>(),
  sirets: new Map<string, string>(),
  registre: new Map<string, unknown>(),
  lectures: [] as string[],
  alertes: [] as Array<Record<string, unknown>>,
  argent: new Set<string>(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findMany: vi.fn(async (a: { where: { statut: { in: string[] } } }) =>
        etat.apporteurs.filter((x) => a.where.statut.in.includes(x.statut as string)),
      ),
    },
    apporteurReseauSiret: {
      findMany: vi.fn(async () =>
        [...etat.sirets].map(([apporteurId, siret]) => ({ apporteurId, siret })),
      ),
    },
    apporteurControleRegistre: {
      findMany: vi.fn(async () => [...etat.lignes.values()]),
      upsert: vi.fn(
        async (a: {
          where: { apporteurId: string };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          const id = a.where.apporteurId;
          const avant = etat.lignes.get(id);
          etat.lignes.set(id, avant ? { ...avant, ...a.update } : { ...a.create });
        },
      ),
    },
  },
}));
vi.mock("../retrait", () => ({ argentEnJeu: async (id: string) => etat.argent.has(id) }));
vi.mock("../annuaire", () => ({
  lireRegistre: vi.fn(async (s: string) => {
    etat.lectures.push(`siret:${s}`);
    return etat.registre.get(s) ?? { ok: false, raison: "indisponible" };
  }),
  lireEntrepriseParSiren: vi.fn(async (s: string) => {
    etat.lectures.push(`siren:${s}`);
    return etat.registre.get(s) ?? { ok: false, raison: "indisponible" };
  }),
}));
vi.mock("../alerte-interne", () => ({
  alerteInterne: vi.fn(async (a: Record<string, unknown>) => {
    etat.alertes.push(a);
    return true;
  }),
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import { controlerRegistreApporteurs, PLAFOND_CONTROLES } from "../controle-registre";

const MAINT = new Date("2026-12-01T10:00:00Z");
const jours = (n: number) => new Date(MAINT.getTime() - n * 86_400_000);
const ACTIVE = { ok: true, entreprise: { active: true } };
const FERMEE = { ok: true, entreprise: { active: false } };
const INTROUVABLE = { ok: false, raison: "introuvable" };

function ajouter(id: string, statut = "signe", siren = "123456789") {
  etat.apporteurs.push({ id, statut, siren });
}
function ligne(id: string, p: Partial<Ligne>) {
  etat.lignes.set(id, {
    apporteurId: id,
    dernierControleAt: jours(30),
    etat: "active",
    etatDepuis: jours(30),
    consecutifs: 1,
    alerteeAt: null,
    ...p,
  });
}

beforeEach(() => {
  etat.apporteurs = [];
  etat.lignes.clear();
  etat.sirets.clear();
  etat.registre.clear();
  etat.lectures = [];
  etat.alertes = [];
  etat.argent.clear();
});

describe("controle du registre des apporteurs", () => {
  it("active : silence, ligne écrite", async () => {
    ajouter("a1");
    etat.registre.set("123456789", ACTIVE);
    await controlerRegistreApporteurs(MAINT);
    expect(etat.alertes).toHaveLength(0);
    expect(etat.lignes.get("a1")?.etat).toBe("active");
  });

  it("fermée une fois : pas d'alerte", async () => {
    ajouter("a1");
    etat.registre.set("123456789", FERMEE);
    await controlerRegistreApporteurs(MAINT);
    expect(etat.alertes).toHaveLength(0);
    expect(etat.lignes.get("a1")).toMatchObject({ etat: "fermee", consecutifs: 1 });
  });

  it("fermée deux fois : une alerte, et pas une seconde au troisième contrôle", async () => {
    ajouter("a1");
    etat.registre.set("123456789", FERMEE);
    await controlerRegistreApporteurs(MAINT);
    ligne("a1", { ...(etat.lignes.get("a1") as Partial<Ligne>), dernierControleAt: jours(8) });
    await controlerRegistreApporteurs(MAINT);
    expect(etat.alertes).toHaveLength(1);
    expect(etat.alertes[0]).toMatchObject({ code: "apporteur_registre_ferme", niveau: "critique" });
    ligne("a1", { ...(etat.lignes.get("a1") as Partial<Ligne>), dernierControleAt: jours(8) });
    await controlerRegistreApporteurs(MAINT);
    const jobIds = new Set(etat.alertes.map((a) => a.jobId));
    expect(jobIds.size).toBe(1);
    expect(etat.lignes.get("a1")?.consecutifs).toBe(3);
  });

  it("introuvable compte comme fermée", async () => {
    ajouter("a1");
    ligne("a1", { etat: "introuvable", consecutifs: 1, dernierControleAt: jours(8) });
    etat.registre.set("123456789", INTROUVABLE);
    await controlerRegistreApporteurs(MAINT);
    expect(etat.alertes).toHaveLength(1);
  });

  it("indisponible : rien n'est écrit, on retente", async () => {
    ajouter("a1");
    await controlerRegistreApporteurs(MAINT);
    expect(etat.lignes.size).toBe(0);
    expect(etat.alertes).toHaveLength(0);
  });

  it("retour à active : la ligne repasse active, aucune alerte", async () => {
    ajouter("a1");
    ligne("a1", { etat: "fermee", consecutifs: 2, dernierControleAt: jours(8) });
    etat.registre.set("123456789", ACTIVE);
    await controlerRegistreApporteurs(MAINT);
    expect(etat.lignes.get("a1")).toMatchObject({ etat: "active", consecutifs: 1 });
    expect(etat.alertes).toHaveLength(0);
  });

  it("plafond de 50 par passage", async () => {
    for (let i = 0; i < 60; i++) ajouter(`a${i}`);
    etat.registre.set("123456789", ACTIVE);
    await controlerRegistreApporteurs(MAINT);
    expect(PLAFOND_CONTROLES).toBe(50);
    expect(etat.lectures).toHaveLength(50);
  });

  it("les plus anciens d'abord ; un contrôle de moins de 7 jours est laissé", async () => {
    for (let i = 0; i < 52; i++) ajouter(`a${i}`);
    for (let i = 0; i < 52; i++) ligne(`a${i}`, { dernierControleAt: jours(10 + i) });
    ligne("a0", { dernierControleAt: jours(2) });
    etat.registre.set("123456789", ACTIVE);
    await controlerRegistreApporteurs(MAINT);
    // a51 (le plus ancien) est lu ; a0 (2 jours) ne l'est pas ; a2 et a1 (les plus récents des vieux) restent.
    expect(etat.lignes.get("a51")?.dernierControleAt).toEqual(MAINT);
    expect(etat.lignes.get("a0")?.dernierControleAt).toEqual(jours(2));
    expect(etat.lignes.get("a1")?.dernierControleAt).not.toEqual(MAINT);
  });

  it("un non-signé est ignoré", async () => {
    ajouter("a1", "a_verifier");
    etat.registre.set("123456789", FERMEE);
    await controlerRegistreApporteurs(MAINT);
    expect(etat.lectures).toHaveLength(0);
  });

  it("un résilié sans argent est ignoré, avec argent il est contrôlé", async () => {
    ajouter("a1", "resilie");
    ajouter("a2", "resilie", "987654321");
    etat.argent.add("a2");
    etat.registre.set("987654321", ACTIVE);
    await controlerRegistreApporteurs(MAINT);
    expect(etat.lectures).toEqual(["siren:987654321"]);
  });

  it("le SIRET est prioritaire sur le SIREN", async () => {
    ajouter("a1");
    etat.sirets.set("a1", "12345678900011");
    etat.registre.set("12345678900011", ACTIVE);
    await controlerRegistreApporteurs(MAINT);
    expect(etat.lectures).toEqual(["siret:12345678900011"]);
  });
});
