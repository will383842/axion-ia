import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  agregerParSemaine,
  analyserDateBing,
  tacheBingReleve,
  type LignePageBing,
} from "../releve";

const CLE_FICTIVE = "cle-de-test-0123456789";

function prismaFictif() {
  const upsert = vi.fn(async () => ({}));
  return {
    upsert,
    prisma: {
      bingPageSemaine: { upsert },
      $transaction: async (ops: ReadonlyArray<Promise<unknown>>) => Promise.all(ops),
    } as never,
  };
}

const jour = (ms: number, page: string, clics: number, imp: number, pos: number) =>
  ({ page, date: new Date(ms), clics, impressions: imp, position: pos }) satisfies LignePageBing;

describe("relevé Bing (P17)", () => {
  beforeEach(() => {
    delete process.env["BING_RELEVE_ENABLED"];
    delete process.env["BING_WMT_API_KEY"];
  });
  afterEach(() => vi.restoreAllMocks());

  it("analyse les dates « /Date(ms)/ » de l'API et refuse le reste", () => {
    expect(analyserDateBing("/Date(1764288000000)/")?.toISOString()).toBe(
      "2025-11-28T00:00:00.000Z",
    );
    expect(analyserDateBing("/Date(1764288000000-0800)/")?.getTime()).toBe(1764288000000);
    expect(analyserDateBing("n'importe quoi")).toBeNull();
    expect(analyserDateBing(42)).toBeNull();
  });

  it("agrège par semaine (lundi) et par page, position pondérée par les impressions", () => {
    const lundi = Date.UTC(2026, 10, 23); // lundi 23/11/2026
    const r = agregerParSemaine([
      jour(lundi, "https://axion-ia.com/fr/a", 1, 10, 2),
      jour(lundi + 3 * 86_400_000, "https://axion-ia.com/fr/a", 2, 30, 4),
      jour(lundi + 7 * 86_400_000, "https://axion-ia.com/fr/a", 0, 5, 9),
    ]);
    expect(r).toHaveLength(2);
    const s1 = r.find((x) => x.semaine === "2026-11-23");
    expect(s1).toMatchObject({ page: "/fr/a", clics: 3, impressions: 40 });
    expect(s1?.positionSum).toBeCloseTo(2 * 10 + 4 * 30);
  });

  it("éteint par défaut : aucune lecture, aucun appel réseau, aucune écriture", async () => {
    process.env["BING_WMT_API_KEY"] = CLE_FICTIVE;
    const lire = vi.fn();
    const { upsert, prisma } = prismaFictif();
    const r = await tacheBingReleve({ prisma, lirePages: lire });
    expect(r).toEqual({ issue: "saute", motif: "bing_releve_eteint" });
    expect(lire).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("allumé sans clé : saute avec le motif « clé Bing absente du worker »", async () => {
    process.env["BING_RELEVE_ENABLED"] = "true";
    const lire = vi.fn();
    const r = await tacheBingReleve({ prisma: prismaFictif().prisma, lirePages: lire });
    expect(r).toEqual({ issue: "saute", motif: "clé Bing absente du worker" });
    expect(lire).not.toHaveBeenCalled();
  });

  it("allumé avec clé : écrit les semaines, sans jamais journaliser la clé", async () => {
    process.env["BING_RELEVE_ENABLED"] = "true";
    process.env["BING_WMT_API_KEY"] = CLE_FICTIVE;
    const journaux: string[] = [];
    for (const m of ["log", "warn", "error"] as const) {
      vi.spyOn(console, m).mockImplementation((...a) => void journaux.push(a.join(" ")));
    }
    const { upsert, prisma } = prismaFictif();
    const r = await tacheBingReleve({
      prisma,
      lirePages: async () => [jour(Date.UTC(2026, 10, 23), "https://axion-ia.com/fr/a", 1, 10, 2)],
    });
    expect(r).toEqual({ issue: "fait", pages: 1, semaines: 1 });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(journaux.join("\n")).not.toContain(CLE_FICTIVE);
  });

  it("lecture indisponible (null) : saute sans écrire", async () => {
    process.env["BING_RELEVE_ENABLED"] = "true";
    process.env["BING_WMT_API_KEY"] = CLE_FICTIVE;
    const { upsert, prisma } = prismaFictif();
    const r = await tacheBingReleve({ prisma, lirePages: async () => null });
    expect(r).toEqual({ issue: "saute", motif: "lecture Bing indisponible" });
    expect(upsert).not.toHaveBeenCalled();
  });
});
