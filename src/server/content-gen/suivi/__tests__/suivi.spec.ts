// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { echeancesDues, fenetreGsc, indexationMesurable } from "../echeances";
import { construireResultat } from "../resultat";
import { tacheSuiviResultats } from "../tache";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("échéances", () => {
  it("rend les échéances échues et pas encore mesurées", () => {
    expect(echeancesDues(d("2026-11-01"), new Set(), d("2026-11-09"))).toEqual(["j3", "j7"]);
    expect(echeancesDues(d("2026-11-01"), new Set(["j3"]), d("2026-11-09"))).toEqual(["j7"]);
    expect(echeancesDues(d("2026-11-01"), new Set(), d("2026-11-03"))).toEqual([]);
    expect(echeancesDues(d("2026-11-01"), new Set(), d("2026-11-04"))).toEqual(["j3"]);
  });
  it("la fenêtre Search Console part du jour de publication", () => {
    const f = fenetreGsc("j7", d("2026-11-01"));
    expect(f.debut).toEqual(d("2026-11-01"));
    expect(f.finExclue).toEqual(d("2026-11-08"));
  });
  it("l'indexation ne se lit qu'à J3/J7, près de l'échéance", () => {
    expect(indexationMesurable("j3", d("2026-11-01"), d("2026-11-04"))).toBe(true);
    expect(indexationMesurable("j3", d("2026-11-01"), d("2026-11-20"))).toBe(false);
    // Inspectée à J1 et inchangée depuis : c'est l'état en vigueur à J3.
    expect(indexationMesurable("j3", d("2026-11-01"), d("2026-11-02"))).toBe(true);
    expect(indexationMesurable("j28", d("2026-11-01"), d("2026-11-29"))).toBe(false);
    expect(indexationMesurable("j7", d("2026-11-01"), null)).toBe(false);
  });
});

describe("construireResultat", () => {
  it("sans donnée Search Console : tout est null, jamais 0", () => {
    const r = construireResultat({
      code: "j7",
      publieLe: d("2026-11-01"),
      gsc: null,
      inspection: null,
      rendezVous: 0,
    });
    expect(r.affichages).toBeNull();
    expect(r.clics).toBeNull();
    expect(r.position).toBeNull();
    expect(r.indexe).toBeNull();
    expect(r.details["donneesInsuffisantes"]).toBe(true);
  });
  it("sous le plancher de 300 impressions à J28 : données insuffisantes", () => {
    const r = construireResultat({
      code: "j28",
      publieLe: d("2026-11-01"),
      gsc: { impressions: 120, clics: 4, positionSum: 120 * 8.5, joursAvecDonnees: 26 },
      inspection: null,
      rendezVous: 1,
    });
    expect(r.position).toBe(8.5);
    expect(r.details["donneesInsuffisantes"]).toBe(true);
    expect(r.details["plancher"]).toBe(300);
  });
  it("au-dessus du plancher : mesure exploitable, et PASS = indexé", () => {
    const r = construireResultat({
      code: "j3",
      publieLe: d("2026-11-01"),
      gsc: { impressions: 40, clics: 1, positionSum: 40 * 12, joursAvecDonnees: 2 },
      inspection: { verdict: "PASS", inspecteLe: d("2026-11-04") },
      rendezVous: 0,
    });
    expect(r.details["donneesInsuffisantes"]).toBe(false);
    expect(r.indexe).toBe(true);
  });
  it("une inspection trop tardive ne dit rien de J3", () => {
    const r = construireResultat({
      code: "j3",
      publieLe: d("2026-11-01"),
      gsc: null,
      inspection: { verdict: "PASS", inspecteLe: d("2026-12-01") },
      rendezVous: null,
    });
    expect(r.indexe).toBeNull();
  });
});

function fauxPrisma(
  opts: { existantes?: Array<{ url: string; echeance: string }>; joursCollectes?: number } = {},
) {
  return {
    siteRoute: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ pathRendered: "/fr/blog/mon-article", createdAt: d("2026-11-01") }]),
    },
    contenuResultat: {
      findMany: vi.fn().mockResolvedValue(opts.existantes ?? []),
      create: vi.fn().mockResolvedValue({}),
    },
    gscPageJour: {
      aggregate: vi
        .fn()
        .mockResolvedValue({ _sum: { clics: 3, impressions: 60, positionSum: 60 * 9 } }),
      count: vi.fn().mockResolvedValue(5),
    },
    gscImportRun: { count: vi.fn().mockResolvedValue(opts.joursCollectes ?? 99) },
    gscInspection: {
      findFirst: vi.fn().mockResolvedValue({ verdict: "PASS", inspecteLe: d("2026-11-04") }),
    },
    contenuRendezVousOrigine: { count: vi.fn().mockResolvedValue(1) },
    contentGenConfig: {
      findUnique: vi.fn().mockResolvedValue({ value: { debut: "2026-10-01T00:00:00.000Z" } }),
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("tacheSuiviResultats", () => {
  it("écrit une ligne par échéance échue, avec l'URL canonique", async () => {
    const p = fauxPrisma();
    const b = await tacheSuiviResultats({ prisma: p as never, maintenant: () => d("2026-11-09") });
    expect(b).toEqual({ contenus: 1, ecrites: 2, dejaEcrites: 0 });
    const echeances = p.contenuResultat.create.mock.calls.map((c) => c[0].data.echeance);
    expect(echeances).toEqual(["j3", "j7"]);
    expect(p.contenuResultat.create.mock.calls[0]![0].data.url).toBe(
      "https://axion-ia.com/fr/blog/mon-article",
    );
    expect(p.contenuResultat.create.mock.calls[0]![0].data.rendezVous).toBe(1);
  });
  it("ne remesure pas une échéance déjà écrite", async () => {
    const p = fauxPrisma({
      existantes: [{ url: "https://axion-ia.com/fr/blog/mon-article", echeance: "j3" }],
    });
    const b = await tacheSuiviResultats({ prisma: p as never, maintenant: () => d("2026-11-09") });
    expect(b.ecrites).toBe(1);
  });
  it("attend que toute la fenêtre Search Console soit collectée", async () => {
    const p = fauxPrisma({ joursCollectes: 2 });
    const b = await tacheSuiviResultats({ prisma: p as never, maintenant: () => d("2026-11-09") });
    expect(b.ecrites).toBe(0);
    expect(p.contenuResultat.create).not.toHaveBeenCalled();
  });
  it("zéro impression sur une fenêtre collectée = 0, pas « indisponible »", async () => {
    const p = fauxPrisma();
    p.gscPageJour.aggregate.mockResolvedValue({
      _sum: { clics: null, impressions: null, positionSum: null },
    });
    await tacheSuiviResultats({ prisma: p as never, maintenant: () => d("2026-11-09") });
    expect(p.contenuResultat.create.mock.calls[0]![0].data.affichages).toBe(0);
  });
  it("rendez-vous null tant que la capture n'avait pas commencé", async () => {
    const p = fauxPrisma();
    p.contentGenConfig.findUnique.mockResolvedValue(null);
    await tacheSuiviResultats({ prisma: p as never, maintenant: () => d("2026-11-09") });
    expect(p.contenuResultat.create.mock.calls[0]![0].data.rendezVous).toBeNull();
  });
  it("pose la date d'allumage au premier passage", async () => {
    const p = fauxPrisma();
    p.contentGenConfig.findUnique.mockResolvedValue(null);
    await tacheSuiviResultats({ prisma: p as never, maintenant: () => d("2026-11-09") });
    expect(p.contentGenConfig.create).toHaveBeenCalledTimes(1);
  });
  it("un jour abandonné (5 tentatives) compte comme réglé", async () => {
    const p = fauxPrisma();
    await tacheSuiviResultats({ prisma: p as never, maintenant: () => d("2026-11-09") });
    const where = p.gscImportRun.count.mock.calls[0]![0].where;
    expect(where.OR).toContainEqual({ tentatives: { gte: 5 } });
  });
  it("ignore les pages d'index du blog", async () => {
    const p = fauxPrisma();
    p.siteRoute.findMany.mockResolvedValue([
      { pathRendered: "/fr/blog/categorie/ia", createdAt: d("2026-11-01") },
      { pathRendered: "/fr/blog/categorie", createdAt: d("2026-11-01") },
      { pathRendered: "/fr/blog/tag", createdAt: d("2026-11-01") },
    ]);
    const b = await tacheSuiviResultats({ prisma: p as never, maintenant: () => d("2026-11-09") });
    expect(b.contenus).toBe(0);
  });
  it("un doublon concurrent (P2002) n'est pas une erreur", async () => {
    const p = fauxPrisma();
    p.contenuResultat.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const b = await tacheSuiviResultats({ prisma: p as never, maintenant: () => d("2026-11-09") });
    expect(b).toEqual({ contenus: 1, ecrites: 0, dejaEcrites: 2 });
  });
});
