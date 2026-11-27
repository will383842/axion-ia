import { describe, expect, it, vi } from "vitest";
import { collecterSectionPilotage } from "../rapport-donnees";

const jour = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ALLUME = { CONTENT_PILOTAGE_SEO: "true" };

function faux(over: Record<string, unknown> = {}) {
  return {
    gscImportRun: {
      findFirst: vi.fn().mockResolvedValue({ jour: jour("2026-11-23") }),
      findMany: vi
        .fn()
        .mockImplementation(async ({ where }: { where: { statut: unknown } }) =>
          where.statut === "reussi"
            ? [
                "17",
                "18",
                "19",
                "20",
                "21",
                "22",
                "23",
                "10",
                "11",
                "12",
                "13",
                "14",
                "15",
                "16",
              ].map((d) => ({ jour: jour(`2026-11-${d}`) }))
            : [],
        ),
    },
    gscPageJour: {
      groupBy: vi
        .fn()
        .mockImplementation(async ({ where }: { where: { date: { gte: Date } } }) =>
          where.date.gte.getTime() === jour("2026-11-17").getTime()
            ? [{ chemin: "/fr/a", _sum: { clics: 12, impressions: 400, positionSum: 4000 } }]
            : [{ chemin: "/fr/a", _sum: { clics: 10, impressions: 500, positionSum: 5500 } }],
        ),
    },
    seoOpportunite: { findMany: vi.fn().mockResolvedValue([]) },
    gscRequete: { findMany: vi.fn().mockResolvedValue([]) },
    gscPageRequeteJour: { groupBy: vi.fn().mockResolvedValue([]) },
    ...over,
  };
}

describe("collecterSectionPilotage", () => {
  it("éteint : aucune lecture de base", async () => {
    const p = faux();
    expect(await collecterSectionPilotage(p as never, {})).toEqual({ etat: "eteint" });
    expect(p.gscImportRun.findFirst).not.toHaveBeenCalled();
  });

  it("build stub : éteint, aucune lecture", async () => {
    const p = faux();
    const r = await collecterSectionPilotage(p as never, {
      ...ALLUME,
      DATABASE_URL: "postgresql://stub:stub@stub.invalid:5432/stub",
    });
    expect(r).toEqual({ etat: "eteint" });
    expect(p.gscImportRun.findFirst).not.toHaveBeenCalled();
  });

  it("allumé : cumule les 7 derniers jours mesurés et les 7 d'avant", async () => {
    const r = await collecterSectionPilotage(faux() as never, ALLUME);
    expect(r.etat).toBe("ok");
    if (r.etat !== "ok") return;
    expect(r.donnees.fin).toBe("2026-11-23");
    expect(r.donnees.courante).toEqual({
      clics: 12,
      impressions: 400,
      positionSum: 4000,
      pages: 1,
      joursMesures: 7,
    });
    expect(r.donnees.precedente?.clics).toBe(10);
  });

  it("un jour non collecté fait baisser joursMesures de sa fenêtre", async () => {
    const p = faux();
    p.gscImportRun.findMany.mockImplementation(async ({ where }: { where: { statut: unknown } }) =>
      where.statut === "reussi" ? [{ jour: jour("2026-11-23") }, { jour: jour("2026-11-10") }] : [],
    );
    const r = await collecterSectionPilotage(p as never, ALLUME);
    expect(
      r.etat === "ok" && [r.donnees.courante?.joursMesures, r.donnees.precedente?.joursMesures],
    ).toEqual([1, 1]);
  });

  it("aucune collecte réussie : pas de chiffres, sans erreur", async () => {
    const p = faux({
      gscImportRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    const r = await collecterSectionPilotage(p as never, ALLUME);
    expect(r.etat === "ok" && r.donnees.courante).toBeNull();
  });

  it("table absente (P2021) ou panne : indisponible, jamais 0", async () => {
    const err = Object.assign(new Error("x"), { code: "P2021" });
    for (const e of [err, new Error("boum")]) {
      const p = faux({
        gscImportRun: { findFirst: vi.fn().mockRejectedValue(e), findMany: vi.fn() },
      });
      expect(await collecterSectionPilotage(p as never, ALLUME)).toEqual({ etat: "indisponible" });
    }
  });

  it("deux pages à 20 affichages : le plancher n'est pas franchi par la somme", async () => {
    const p = faux();
    p.seoOpportunite.findMany.mockResolvedValue([
      {
        semaine: jour("2026-11-16"),
        detecteur: "d",
        cible: "/fr/a",
        priorite: 9,
        details: { requeteId: 7 },
      },
    ]);
    p.gscRequete.findMany.mockResolvedValue([{ id: 7, texte: "formation ia" }]);
    p.gscPageRequeteJour.groupBy.mockResolvedValue([
      { requeteId: 7, chemin: "/fr/a", _sum: { impressions: 20 } },
      { requeteId: 7, chemin: "/fr/b", _sum: { impressions: 20 } },
    ]);
    const r = await collecterSectionPilotage(p as never, ALLUME);
    expect(r.etat === "ok" && r.donnees.opportunites[0]?.impressions28j).toBe(20);
  });

  it("signale une collecte en retard de plus de 4 jours", async () => {
    const r = await collecterSectionPilotage(
      faux() as never,
      ALLUME,
      () => new Date("2026-12-05T08:00:00Z"),
    );
    expect(r.etat === "ok" && r.donnees.sourcesIndisponibles.join(" ")).toMatch(
      /dernière collecte/,
    );
  });

  it("signale les jours en échec récents comme source indisponible", async () => {
    const p = faux();
    p.gscImportRun.findMany.mockImplementation(async ({ where }: { where: { statut: unknown } }) =>
      where.statut === "reussi" ? [] : [{ jour: jour("2026-11-14"), statut: "echec" }],
    );
    const r = await collecterSectionPilotage(p as never, ALLUME);
    expect(r.etat === "ok" && r.donnees.sourcesIndisponibles.join(" ")).toMatch(/14\/11\/2026/);
  });

  it("n'expose le texte d'une requête qu'avec ses affichages sur 28 jours", async () => {
    const p = faux();
    p.seoOpportunite.findMany.mockResolvedValue([
      {
        semaine: jour("2026-11-16"),
        detecteur: "quasi_gagnante",
        cible: "/fr/a",
        priorite: 9,
        details: { requeteId: 7 },
      },
    ]);
    p.gscRequete.findMany.mockResolvedValue([{ id: 7, texte: "formation ia" }]);
    p.gscPageRequeteJour.groupBy.mockResolvedValue([
      { requeteId: 7, chemin: "/fr/a", _sum: { impressions: 35 } },
    ]);
    const r = await collecterSectionPilotage(
      p as never,
      ALLUME,
      () => new Date("2026-11-24T08:00:00Z"),
    );
    expect(r.etat === "ok" && r.donnees.opportunites[0]).toMatchObject({
      requete: "formation ia",
      impressions28j: 35,
    });
  });
});
