import { describe, expect, it, vi } from "vitest";

import { lireModelePilotage } from "../lecture";

function fauxPrisma(surcharges: Record<string, unknown> = {}) {
  const vide = () => vi.fn().mockResolvedValue([]);
  return {
    gscImportRun: { findMany: vide() },
    gscPageJour: { groupBy: vide() },
    gscPageRequeteSemaine: { groupBy: vide() },
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
});
