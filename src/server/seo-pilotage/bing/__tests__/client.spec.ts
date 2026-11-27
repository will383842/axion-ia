import { describe, expect, it, vi } from "vitest";

import {
  bingPilotageActif,
  dateBing,
  lireExplorationBing,
  lirePagesBing,
  lireRequetesBing,
} from "../client";

const CLE = "cle-secrete-de-test-0123456789";
const env = { BING_WMT_API_KEY: CLE, NEXT_PUBLIC_SITE_URL: "https://axion-ia.com" };

const reponse = (corps: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corps }) as Response;

describe("client Bing Webmaster", () => {
  it("clé absente ou vide : inactif, aucun appel réseau", async () => {
    const f = vi.fn();
    for (const e of [{}, { BING_WMT_API_KEY: "  " }]) {
      expect(bingPilotageActif(e)).toBe(false);
      expect(await lirePagesBing({ fetch: f, env: e })).toEqual({ etat: "inactif", lignes: [] });
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("lit les dates au format /Date(ms)/ et ignore les valeurs illisibles", () => {
    expect(dateBing("/Date(1700000000000)/")).toBe("2023-11-14");
    expect(dateBing("/Date(1700000000000-0700)/")).toBe("2023-11-14");
    expect(dateBing("2026-11-02T00:00:00Z")).toBe("2026-11-02");
    expect(dateBing("n'importe quoi")).toBeNull();
    expect(dateBing(42)).toBeNull();
  });

  it("pages : appelle GetPageStats avec la clé et lit les lignes valides", async () => {
    const f = vi.fn(async () =>
      reponse({
        d: [
          {
            Query: "https://axion-ia.com/fr/blog",
            Date: "/Date(1700000000000)/",
            Clicks: 2,
            Impressions: 10,
            AvgImpressionPosition: 4.5,
          },
          { Query: "x", Date: "pas une date", Clicks: 1, Impressions: 1 },
        ],
      }),
    );
    const r = await lirePagesBing({ fetch: f as never, env });
    expect(r.etat).toBe("ok");
    expect(r.lignes).toEqual([
      {
        cle: "https://axion-ia.com/fr/blog",
        jour: "2023-11-14",
        clics: 2,
        impressions: 10,
        position: 4.5,
      },
    ]);
    const url = String((f.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/GetPageStats?");
    expect(url).toContain(`apikey=${CLE}`);
  });

  it("requêtes et exploration : endpoints dédiés", async () => {
    const f = vi.fn(async () =>
      reponse({
        d: [
          {
            Date: "/Date(1700000000000)/",
            CrawledPages: 5,
            CrawlErrors: 1,
            InIndex: 40,
            Code4xx: 2,
            Code5xx: 0,
            Query: "formation ia",
            Clicks: 1,
            Impressions: 3,
            AvgImpressionPosition: 7,
          },
        ],
      }),
    );
    const q = await lireRequetesBing({ fetch: f as never, env });
    expect(q.lignes[0]).toMatchObject({ cle: "formation ia", impressions: 3 });
    const e = await lireExplorationBing({ fetch: f as never, env });
    expect(e.lignes[0]).toEqual({
      jour: "2023-11-14",
      pagesExplorees: 5,
      erreurs: 1,
      pagesIndexees: 40,
      codes4xx: 2,
      codes5xx: 0,
    });
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/GetQueryStats?");
    expect(String((f.mock.calls[1] as unknown[])[0])).toContain("/GetCrawlStats?");
  });

  it("écarte les lignes sans position valide ; json illisible = reponse_invalide", async () => {
    const f = async () =>
      reponse({
        d: [
          {
            Query: "a",
            Date: "/Date(1700000000000)/",
            Clicks: 1,
            Impressions: 5,
            AvgImpressionPosition: -1,
          },
          { Query: "b", Date: "/Date(1700000000000)/", Clicks: 1, Impressions: 5 },
        ],
      });
    expect((await lirePagesBing({ fetch: f as never, env })).lignes).toEqual([]);
    const illisible = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("x");
        },
      }) as unknown as Response;
    expect((await lirePagesBing({ fetch: illisible as never, env })).etat).toBe("reponse_invalide");
  });

  it("429 = quota ; autre statut = erreur ; panne réseau = reseau ; corps invalide", async () => {
    expect(
      (await lirePagesBing({ fetch: (async () => reponse({}, 429)) as never, env })).etat,
    ).toBe("quota");
    expect(
      (await lirePagesBing({ fetch: (async () => reponse({}, 500)) as never, env })).etat,
    ).toBe("erreur_http");
    expect(
      (
        await lirePagesBing({
          fetch: (async () => {
            throw new Error("boom");
          }) as never,
          env,
        })
      ).etat,
    ).toBe("reseau");
    expect(
      (await lirePagesBing({ fetch: (async () => reponse({ d: "x" })) as never, env })).etat,
    ).toBe("reponse_invalide");
  });

  it("la clé ne sort JAMAIS dans un journal, même sur erreur (l'URL contient la clé)", async () => {
    const journaux: string[] = [];
    const espions = (["log", "warn", "error"] as const).map((m) =>
      vi
        .spyOn(console, m)
        .mockImplementation((...a: unknown[]) => void journaux.push(a.map(String).join(" "))),
    );
    const fautes = [
      async () => reponse({}, 500),
      async () => reponse({}, 429),
      async () => {
        throw new Error(`fetch failed https://ssl.bing.com/x?apikey=${CLE}`);
      },
    ];
    for (const fx of fautes) await lirePagesBing({ fetch: fx as never, env });
    espions.forEach((e) => e.mockRestore());
    expect(journaux.join("\n")).not.toContain(CLE);
  });
});
