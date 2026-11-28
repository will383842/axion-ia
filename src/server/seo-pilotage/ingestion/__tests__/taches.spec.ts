import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GscLotResultat } from "@/server/content-gen/seo/gsc-client";
import { creerFauxPrisma } from "./faux-prisma";

const dernierJourFinal = vi.fn();
vi.mock("@/server/content-gen/seo/gsc-client", async (orig) => ({
  ...(await orig<typeof import("@/server/content-gen/seo/gsc-client")>()),
  gscDernierJourFinal: dernierJourFinal,
}));

const {
  BUDGET_PASSAGE_MS,
  JOURS_PAR_PASSAGE,
  PAUSE_ENTRE_JOURS_MS,
  tacheIngestionGsc,
  tacheRattrapageGsc,
} = await import("../taches");

const ok = (rows: never[] = []): GscLotResultat => ({ etat: "ok", rows, complet: true });
const date = (j: string) => new Date(`${j}T00:00:00Z`);

describe("tâches de collecte", () => {
  beforeEach(() =>
    dernierJourFinal.mockReset().mockResolvedValue({ etat: "ok", jour: "2026-11-24" }),
  );

  it("ingestion : importe le dernier jour final détecté", async () => {
    const { prisma, base } = creerFauxPrisma();
    const recherche = vi.fn(async () => ok());
    const r = await tacheIngestionGsc({ prisma, recherche });
    expect(r).toMatchObject({ issue: "fait", jour: { issue: "reussi", jour: "2026-11-24" } });
    expect(base.gscImportRun.lignes).toHaveLength(1);
  });

  it("ingestion : identifiants absents ou aucune donnée finale → saut, aucune écriture", async () => {
    const { prisma, base } = creerFauxPrisma();
    dernierJourFinal.mockResolvedValue({ etat: "identifiants_absents", jour: null });
    expect(await tacheIngestionGsc({ prisma })).toMatchObject({
      issue: "saute",
      motif: "identifiants_absents",
    });
    dernierJourFinal.mockResolvedValue({ etat: "ok", jour: null });
    expect(await tacheIngestionGsc({ prisma })).toMatchObject({
      issue: "saute",
      motif: "aucune_donnee",
    });
    expect(base.gscImportRun.lignes).toHaveLength(0);
  });

  const sansPause = { pause: async () => undefined };

  it("rattrapage : jusqu'à JOURS_PAR_PASSAGE jours par passage, du plus récent au plus ancien", async () => {
    const { prisma, base } = creerFauxPrisma();
    const recherche = vi.fn(async () => ok());
    const r1 = await tacheRattrapageGsc({ prisma, recherche, ...sansPause });
    expect(r1).toMatchObject({ issue: "lot", arret: "plafond" });
    const jours1 = (r1 as { jours: Array<{ jour: string }> }).jours.map((j) => j.jour);
    expect(jours1).toHaveLength(JOURS_PAR_PASSAGE);
    expect(jours1[0]).toBe("2026-11-23");
    expect(jours1[1]).toBe("2026-11-22");
    const r2 = await tacheRattrapageGsc({ prisma, recherche, ...sansPause });
    const jours2 = (r2 as { jours: Array<{ jour: string }> }).jours.map((j) => j.jour);
    expect(jours2).toHaveLength(JOURS_PAR_PASSAGE);
    // idempotent : aucun jour rejoué
    expect(new Set([...jours1, ...jours2]).size).toBe(2 * JOURS_PAR_PASSAGE);
    expect(base.gscImportRun.lignes).toHaveLength(2 * JOURS_PAR_PASSAGE);
  });

  it("rattrapage : pause entre deux jours, jamais avant le premier", async () => {
    const { prisma } = creerFauxPrisma();
    const pause = vi.fn(async () => undefined);
    await tacheRattrapageGsc({
      prisma,
      recherche: vi.fn(async () => ok()),
      pause,
      joursParPassage: 3,
    });
    expect(pause).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledWith(PAUSE_ENTRE_JOURS_MS);
  });

  it("rattrapage : s'arrête net au premier quota, sans toucher aux jours suivants", async () => {
    const { prisma, base } = creerFauxPrisma();
    let n = 0;
    const recherche = vi.fn(async () =>
      ++n > 3 ? ({ etat: "quota", rows: [], complet: false } as never) : ok(),
    );
    const r = await tacheRattrapageGsc({ prisma, recherche, ...sansPause });
    expect(r).toMatchObject({ issue: "lot", arret: "echec" });
    const jours = (r as { jours: Array<{ issue: string; code?: string }> }).jours;
    expect(jours.map((j) => j.issue)).toEqual(["reussi", "echec"]);
    expect(jours[1]?.code).toBe("quota");
    // le quota ne compte pas comme une tentative
    expect(base.gscImportRun.lignes.find((l) => l.statut === "echec")?.tentatives).toBe(0);
  });

  it("rattrapage : s'arrête quand le budget de temps est dépassé", async () => {
    const { prisma } = creerFauxPrisma();
    let t = 0;
    const r = await tacheRattrapageGsc({
      prisma,
      recherche: vi.fn(async () => ok()),
      pause: async () => undefined,
      horloge: () => (t += BUDGET_PASSAGE_MS / 2),
    });
    expect(r).toMatchObject({ issue: "lot", arret: "temps" });
    expect((r as { jours: unknown[] }).jours.length).toBeGreaterThanOrEqual(1);
    expect((r as { jours: unknown[] }).jours.length).toBeLessThan(JOURS_PAR_PASSAGE);
  });

  it("rattrapage : saute les jours réussis, reprend un échec, abandonne après 5 tentatives", async () => {
    const { prisma, base } = creerFauxPrisma();
    const recherche = vi.fn(async () => ok());
    const mk = (jour: string, statut: string, tentatives = 1) =>
      base.gscImportRun.create({
        data: {
          jour: date(jour),
          typeRecherche: "web",
          statut,
          tentatives,
          debutLe: new Date("2020-01-01"),
        },
      });
    await mk("2026-11-23", "reussi");
    await mk("2026-11-22", "echec", 5); // abandonné
    await mk("2026-11-21", "echec", 2); // à reprendre
    const r = await tacheRattrapageGsc({ prisma, recherche, ...sansPause, joursParPassage: 1 });
    expect(r).toMatchObject({ issue: "lot", jours: [{ jour: "2026-11-21", issue: "reussi" }] });
  });

  it("rattrapage : s'arrête à 16 mois et dit « historique complet »", async () => {
    const { prisma, base } = creerFauxPrisma();
    const recherche = vi.fn(async () => ok());
    // 2026-11-24 − 16 mois = 2025-07-24 ; on marque tout le trou comme réussi
    for (
      let d = date("2025-07-24");
      d < date("2026-11-24");
      d = new Date(d.getTime() + 86_400_000)
    ) {
      base.gscImportRun.lignes.push({
        id: `x${d.getTime()}`,
        jour: d,
        typeRecherche: "web",
        statut: "reussi",
        tentatives: 1,
        debutLe: d,
      });
    }
    expect(await tacheRattrapageGsc({ prisma, recherche })).toMatchObject({ issue: "termine" });
    expect(recherche).not.toHaveBeenCalled();
  });
});
