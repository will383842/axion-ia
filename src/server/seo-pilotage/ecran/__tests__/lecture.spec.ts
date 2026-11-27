import { describe, expect, it, vi } from "vitest";

import { lireModelePilotage } from "../lecture";

function fauxPrisma(surcharges: Record<string, unknown> = {}) {
  const vide = () => vi.fn().mockResolvedValue([]);
  return {
    gscImportRun: { findMany: vide() },
    gscPageJour: { groupBy: vide() },
    gscPageRequeteJour: { groupBy: vide() },
    gscRequete: { findMany: vide() },
    seoOpportunite: { findMany: vide() },
    contentGenConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    ...surcharges,
  } as never;
}

describe("lireModelePilotage", () => {
  it("pilotage éteint : « eteint » et aucune lecture en base", async () => {
    const prisma = fauxPrisma();
    const m = await lireModelePilotage({ prisma, env: {}, aujourdhui: "2026-11-27" });
    expect(m).toEqual({ etat: "eteint" });
    expect(
      (prisma as { gscImportRun: { findMany: ReturnType<typeof vi.fn> } }).gscImportRun.findMany,
    ).not.toHaveBeenCalled();
  });

  it("« true » exact seulement allume l'écran", async () => {
    const m = await lireModelePilotage({
      prisma: fauxPrisma(),
      env: { CONTENT_PILOTAGE_SEO: "TRUE" },
      aujourdhui: "2026-11-27",
    });
    expect(m.etat).toBe("eteint");
  });

  it("allumé sans import : source indisponible, sections indisponibles (null), pas de zéros", async () => {
    const m = await lireModelePilotage({
      prisma: fauxPrisma(),
      env: { CONTENT_PILOTAGE_SEO: "true" },
      aujourdhui: "2026-11-27",
    });
    if (m.etat !== "actif") throw new Error("attendu actif");
    expect(m.source.etat).toBe("indisponible");
    expect(m.vue).toBeNull();
    expect(m.pages).toBeNull();
    expect(m.requetes).toBeNull();
    expect(m.mode).toBe("observation");
  });

  it("une lecture qui échoue rend sa section indisponible, sans casser les autres", async () => {
    const prisma = fauxPrisma({
      gscImportRun: {
        findMany: vi.fn().mockResolvedValue([{ jour: new Date("2026-11-25"), statut: "reussi" }]),
      },
      gscPageJour: {
        groupBy: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code: "P2021" })),
      },
    });
    const m = await lireModelePilotage({
      prisma,
      env: { CONTENT_PILOTAGE_SEO: "true" },
      aujourdhui: "2026-11-27",
    });
    if (m.etat !== "actif") throw new Error("attendu actif");
    expect(m.source.etat).toBe("disponible");
    expect(m.vue).toBeNull();
    expect(m.pages).toBeNull();
    expect(m.opportunites).toEqual([]);
  });

  it("vue d'ensemble composée depuis deux fenêtres de 28 jours", async () => {
    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([
        { typePage: "article", _sum: { clics: 12, impressions: 400, positionSum: 3200 } },
      ])
      .mockResolvedValueOnce([
        { typePage: "article", _sum: { clics: 10, impressions: 500, positionSum: 5000 } },
      ])
      .mockResolvedValue([]);
    const m = await lireModelePilotage({
      prisma: fauxPrisma({
        gscImportRun: {
          findMany: vi.fn().mockResolvedValue([{ jour: new Date("2026-11-25"), statut: "reussi" }]),
        },
        gscPageJour: { groupBy },
      }),
      env: { CONTENT_PILOTAGE_SEO: "true" },
      aujourdhui: "2026-11-27",
    });
    if (m.etat !== "actif") throw new Error("attendu actif");
    expect(m.vue?.[0]).toMatchObject({ typePage: "article", clics: 12 });
    expect(m.donneesJusquAu).toBe("2026-11-25");
  });

  it("requêtes : lues dans le détail journalier récent, pas dans les semaines purgées", async () => {
    const jour = vi
      .fn()
      .mockResolvedValue([
        { requeteId: 1, chemin: "/fr/a", _sum: { clics: 2, impressions: 50, positionSum: 300 } },
      ]);
    const m = await lireModelePilotage({
      prisma: fauxPrisma({
        gscImportRun: {
          findMany: vi.fn().mockResolvedValue([{ jour: new Date("2026-11-25"), statut: "reussi" }]),
        },
        gscPageRequeteJour: { groupBy: jour },
        gscRequete: { findMany: vi.fn().mockResolvedValue([{ id: 1, texte: "formation ia" }]) },
      }),
      env: { CONTENT_PILOTAGE_SEO: "true" },
      aujourdhui: "2026-11-27",
    });
    if (m.etat !== "actif") throw new Error("attendu actif");
    expect(m.requetes?.map((r) => r.requete)).toEqual(["formation ia"]);
    const where = jour.mock.calls[0]?.[0].where;
    expect(where.date.gte).toEqual(new Date("2026-10-29T00:00:00Z"));
    expect(where.date.lte).toEqual(new Date("2026-11-25T00:00:00Z"));
  });

  it("pages : le filtre par type est appliqué en base, avant la limite", async () => {
    const groupBy = vi.fn().mockResolvedValue([]);
    await lireModelePilotage({
      prisma: fauxPrisma({
        gscImportRun: {
          findMany: vi.fn().mockResolvedValue([{ jour: new Date("2026-11-25"), statut: "reussi" }]),
        },
        gscPageJour: { groupBy },
      }),
      env: { CONTENT_PILOTAGE_SEO: "true" },
      aujourdhui: "2026-11-27",
      type: "ville",
    });
    const appelPages = groupBy.mock.calls.find((c) => c[0].by.includes("chemin"));
    expect(appelPages?.[0].where.typePage).toBe("ville");
  });

  it("fenêtres incomplètes : aucune évolution calculée, et l'écran est prévenu", async () => {
    const groupBy = vi
      .fn()
      .mockResolvedValue([
        { typePage: "article", _sum: { clics: 12, impressions: 400, positionSum: 3200 } },
      ]);
    const jours = Array.from({ length: 28 }, (_, i) => ({
      jour: new Date(Date.UTC(2026, 10, 25 - i)),
      statut: "reussi",
    }));
    const m = await lireModelePilotage({
      prisma: fauxPrisma({
        gscImportRun: { findMany: vi.fn().mockResolvedValue(jours) },
        gscPageJour: { groupBy },
      }),
      env: { CONTENT_PILOTAGE_SEO: "true" },
      aujourdhui: "2026-11-27",
    });
    if (m.etat !== "actif") throw new Error("attendu actif");
    expect(m.fenetreCouranteComplete).toBe(true);
    expect(m.comparaisonPossible).toBe(false);
    expect(m.vue?.[0]?.variationClics).toBeNull();
  });

  it("56 jours reçus : comparaison possible, évolution calculée ; lecture d'au moins 56 imports", async () => {
    const jours = Array.from({ length: 56 }, (_, i) => ({
      jour: new Date(Date.UTC(2026, 10, 25 - i)),
      statut: "reussi",
    }));
    const findMany = vi.fn().mockResolvedValue(jours);
    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([
        { typePage: "article", _sum: { clics: 12, impressions: 400, positionSum: 3200 } },
      ])
      .mockResolvedValueOnce([
        { typePage: "article", _sum: { clics: 10, impressions: 500, positionSum: 5000 } },
      ])
      .mockResolvedValue([]);
    const m = await lireModelePilotage({
      prisma: fauxPrisma({
        gscImportRun: { findMany },
        gscPageJour: { groupBy },
      }),
      env: { CONTENT_PILOTAGE_SEO: "true" },
      aujourdhui: "2026-11-27",
    });
    if (m.etat !== "actif") throw new Error("attendu actif");
    expect(findMany.mock.calls[0]?.[0].take).toBeGreaterThanOrEqual(56);
    expect(m.comparaisonPossible).toBe(true);
    expect(m.vue?.[0]?.variationClics).toBeCloseTo(20);
  });

  it("fenêtre courante incomplète (27 jours) : aucune évolution, même si la précédente est complète", async () => {
    // jours 2026-11-25 … avec un trou : on retire le jour 2026-11-10 (dans la fenêtre courante)
    const jours = Array.from({ length: 56 }, (_, i) => ({
      jour: new Date(Date.UTC(2026, 10, 25 - i)),
      statut: "reussi",
    })).filter((j) => j.jour.toISOString().slice(0, 10) !== "2026-11-10");
    const groupBy = vi
      .fn()
      .mockResolvedValue([
        { typePage: "article", _sum: { clics: 12, impressions: 400, positionSum: 3200 } },
      ]);
    const m = await lireModelePilotage({
      prisma: fauxPrisma({
        gscImportRun: { findMany: vi.fn().mockResolvedValue(jours) },
        gscPageJour: { groupBy },
      }),
      env: { CONTENT_PILOTAGE_SEO: "true" },
      aujourdhui: "2026-11-27",
    });
    if (m.etat !== "actif") throw new Error("attendu actif");
    expect(m.fenetreCouranteComplete).toBe(false);
    expect(m.comparaisonPossible).toBe(false);
    expect(m.vue?.[0]?.variationClics).toBeNull();
  });

  it("requêtes : celles qui portent un mot interdit ne sont jamais montrées", async () => {
    const jour = vi.fn().mockResolvedValue([
      { requeteId: 1, chemin: "/fr/a", _sum: { clics: 2, impressions: 50, positionSum: 300 } },
      { requeteId: 2, chemin: "/fr/b", _sum: { clics: 2, impressions: 50, positionSum: 300 } },
    ]);
    const m = await lireModelePilotage({
      prisma: fauxPrisma({
        gscImportRun: {
          findMany: vi.fn().mockResolvedValue([{ jour: new Date("2026-11-25"), statut: "reussi" }]),
        },
        gscPageRequeteJour: { groupBy: jour },
        gscRequete: {
          findMany: vi.fn().mockResolvedValue([
            { id: 1, texte: "formation ia" },
            { id: 2, texte: "formation ia grenoble" },
          ]),
        },
      }),
      env: { CONTENT_PILOTAGE_SEO: "true" },
      aujourdhui: "2026-11-27",
    });
    if (m.etat !== "actif") throw new Error("attendu actif");
    expect(m.requetes?.map((r) => r.requete)).toEqual(["formation ia"]);
  });
});
