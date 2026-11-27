import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GscLotResultat } from "@/server/content-gen/seo/gsc-client";
import { creerFauxPrisma } from "./faux-prisma";

const dernierJourFinal = vi.fn();
vi.mock("@/server/content-gen/seo/gsc-client", async (orig) => ({
  ...(await orig<typeof import("@/server/content-gen/seo/gsc-client")>()),
  gscDernierJourFinal: dernierJourFinal,
}));

const { tacheIngestionGsc, tacheRattrapageGsc } = await import("../taches");

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

  it("rattrapage : UN jour par passage, du plus récent au plus ancien", async () => {
    const { prisma, base } = creerFauxPrisma();
    const recherche = vi.fn(async () => ok());
    const j1 = await tacheRattrapageGsc({ prisma, recherche });
    expect(j1).toMatchObject({ issue: "fait", jour: { jour: "2026-11-23" } });
    const j2 = await tacheRattrapageGsc({ prisma, recherche });
    expect(j2).toMatchObject({ issue: "fait", jour: { jour: "2026-11-22" } });
    expect(base.gscImportRun.lignes).toHaveLength(2);
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
    const r = await tacheRattrapageGsc({ prisma, recherche });
    expect(r).toMatchObject({ issue: "fait", jour: { jour: "2026-11-21", issue: "reussi" } });
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
